aws-refresh-mfa() {
  if ! command -v aws >/dev/null 2>&1; then
    echo "aws CLI is required"
    return 1
  fi

  local source_profile session_profile mfa_serial token_code duration region creds
  local access_key secret_key session_token expiration
  local profiles=() mfa_devices=()

  mapfile -t profiles < <(aws configure list-profiles 2>/dev/null)
  if [[ ${#profiles[@]} -eq 0 ]]; then
    echo "no AWS profiles configured"
    return 1
  fi

  source_profile="$(_aws_pick "Source profile" "${profiles[@]}")"
  [[ -z "$source_profile" ]] && return 1

  session_profile="$source_profile-mfa"

  echo "Fetching MFA devices for $source_profile..."
  mapfile -t mfa_devices < <(aws iam list-mfa-devices \
    --profile "$source_profile" \
    --query 'MFADevices[].SerialNumber' --output text 2>/dev/null | tr '\t' '\n')
  if [[ ${#mfa_devices[@]} -eq 0 || -z "${mfa_devices[0]}" ]]; then
    echo "no MFA devices visible for profile $source_profile"
    return 1
  fi

  if [[ ${#mfa_devices[@]} -eq 1 ]]; then
    mfa_serial="${mfa_devices[0]}"
    printf 'MFA device: %s\n' "$mfa_serial"
  else
    mfa_serial="$(_aws_pick "MFA device" "${mfa_devices[@]}")"
    [[ -z "$mfa_serial" ]] && return 1
  fi

  read -r -p "MFA code: " token_code
  if [[ -z "$token_code" ]]; then
    echo "MFA code is required"
    return 1
  fi

  if [[ ! "$token_code" =~ ^[0-9]{6}$ ]]; then
    echo "MFA code must be 6 digits"
    return 1
  fi

  read -r -p "Duration seconds [43200]: " duration
  duration="${duration:-43200}"

  if [[ ! "$duration" =~ ^[0-9]+$ ]]; then
    echo "duration must be numeric"
    return 1
  fi

  region="$(aws configure get region --profile "$source_profile")"

  echo "Requesting session token..."
  creds="$(aws sts get-session-token \
    --profile "$source_profile" \
    --serial-number "$mfa_serial" \
    --token-code "$token_code" \
    --duration-seconds "$duration" \
    --query 'Credentials.[AccessKeyId,SecretAccessKey,SessionToken,Expiration]' \
    --output text)" || return 1

  echo "Writing credentials to profile $session_profile..."

  read -r access_key secret_key session_token expiration <<<"$creds"

  aws configure set aws_access_key_id "$access_key" --profile "$session_profile"
  aws configure set aws_secret_access_key "$secret_key" --profile "$session_profile"
  aws configure set aws_session_token "$session_token" --profile "$session_profile"

  if [[ -n "$region" ]]; then
    aws configure set region "$region" --profile "$session_profile"
  fi

  printf 'Refreshed %s until %s\n' "$session_profile" "$expiration"
}

_aws_pick() {
  local header="$1"
  shift
  if [[ $# -eq 0 ]]; then
    return 1
  fi
  if command -v fzf >/dev/null 2>&1; then
    printf '%s\n' "$@" | fzf --height=40% --reverse --prompt="$header > " --header="$header" --no-multi
  else
    local choice
    PS3="$header # "
    select choice in "$@"; do
      if [[ -n "$choice" ]]; then
        printf '%s\n' "$choice"
        break
      fi
    done
    unset PS3
  fi
}

aws-codeartifact-login() {
  if ! command -v aws >/dev/null 2>&1; then
    echo "aws CLI is required"
    return 1
  fi

  local profile tool domain domain_owner repository region
  local profiles=() domain_labels=() domain_names=() domain_owners=() repos=()
  local tools=(npm pip nuget swift dotnet twine cargo generic)

  mapfile -t profiles < <(aws configure list-profiles 2>/dev/null)
  if [[ ${#profiles[@]} -eq 0 ]]; then
    echo "no AWS profiles configured"
    return 1
  fi

  profile="$(_aws_pick "AWS profile" "${profiles[@]}")"
  [[ -z "$profile" ]] && return 1

  region="$(aws configure get region --profile "$profile" 2>/dev/null)"
  if [[ -z "$region" ]]; then
    read -r -p "Region: " region
    if [[ -z "$region" ]]; then
      echo "region is required"
      return 1
    fi
  fi

  echo "Resolving caller identity for $profile..."
  local account_id
  account_id="$(aws sts get-caller-identity --profile "$profile" --query 'Account' --output text 2>/dev/null)"
  if [[ -z "$account_id" || "$account_id" == "None" ]]; then
    echo "unable to resolve caller identity for profile $profile — run aws-refresh-mfa first?"
    return 1
  fi
  printf 'Profile %s -> account %s, region %s\n' "$profile" "$account_id" "$region"

  echo "Listing CodeArtifact domains..."
  local domains_raw
  domains_raw="$(aws codeartifact list-domains \
    --profile "$profile" --region "$region" \
    --query 'domains[].[name,owner]' --output text 2>/dev/null)"
  if [[ -z "$domains_raw" ]]; then
    echo "no CodeArtifact domains visible from this profile/region"
    return 1
  fi

  local name owner
  while IFS=$'\t' read -r name owner; do
    [[ -z "$name" ]] && continue
    local label="$name"
    [[ "$owner" != "$account_id" ]] && label="$name (owner $owner)"
    domain_labels+=("$label")
    domain_names+=("$name")
    domain_owners+=("$owner")
  done <<< "$domains_raw"

  if [[ ${#domain_labels[@]} -eq 1 ]]; then
    domain="${domain_names[0]}"
    domain_owner="${domain_owners[0]}"
    printf 'Domain: %s\n' "${domain_labels[0]}"
  else
    local chosen_label
    chosen_label="$(_aws_pick "Domain" "${domain_labels[@]}")"
    [[ -z "$chosen_label" ]] && return 1

    local i
    for i in "${!domain_labels[@]}"; do
      if [[ "${domain_labels[$i]}" == "$chosen_label" ]]; then
        domain="${domain_names[$i]}"
        domain_owner="${domain_owners[$i]}"
        break
      fi
    done
  fi

  echo "Listing repositories in domain $domain..."
  local repos_raw
  repos_raw="$(aws codeartifact list-repositories-in-domain \
    --domain "$domain" --domain-owner "$domain_owner" \
    --profile "$profile" --region "$region" \
    --query 'repositories[].name' --output text 2>/dev/null)"
  if [[ -z "$repos_raw" ]]; then
    echo "no repositories in domain $domain"
    return 1
  fi

  mapfile -t repos < <(printf '%s\n' "$repos_raw" | tr '\t' '\n')

  if [[ ${#repos[@]} -eq 1 ]]; then
    repository="${repos[0]}"
    printf 'Repository: %s\n' "$repository"
  else
    repository="$(_aws_pick "Repository" "${repos[@]}")"
    [[ -z "$repository" ]] && return 1
  fi

  tool="$(_aws_pick "Package tool" "${tools[@]}")"
  [[ -z "$tool" ]] && return 1

  local namespace=""
  if [[ "$tool" == "npm" ]]; then
    namespace="$domain"
  fi

  local login_args=(
    --tool "$tool"
    --domain "$domain"
    --domain-owner "$domain_owner"
    --repository "$repository"
    --region "$region"
    --profile "$profile"
  )
  [[ -n "$namespace" ]] && login_args+=(--namespace "$namespace")

  echo "Logging in to CodeArtifact ($domain/$repository as $tool)..."
  aws codeartifact login "${login_args[@]}" || return 1

  if [[ "$tool" == "npm" && -n "$namespace" ]]; then
    local npmrc="${NPM_CONFIG_USERCONFIG:-$HOME/.npmrc}"
    local ca_url="https://${domain}-${domain_owner}.d.codeartifact.${region}.amazonaws.com/npm/${repository}/"
    if [[ -f "$npmrc" ]] && grep -Fqx "registry=${ca_url}" "$npmrc"; then
      local tmp
      tmp="$(mktemp)"
      grep -Fvx "registry=${ca_url}" "$npmrc" > "$tmp" && mv "$tmp" "$npmrc"
      echo "Removed stray default registry= line from $npmrc (scope @$namespace is still bound)"
    fi
  fi
}
