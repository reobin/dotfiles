aws-refresh-mfa() {
  if ! command -v aws >/dev/null 2>&1; then
    echo "aws CLI is required"
    return 1
  fi

  local source_profile session_profile mfa_serial token_code duration region creds
  local access_key secret_key session_token expiration
  local profiles=() mfa_devices=()

  profiles=("${(@f)$(aws configure list-profiles 2>/dev/null)}")
  if [[ ${#profiles[@]} -eq 0 ]]; then
    echo "no AWS profiles configured"
    return 1
  fi

  source_profile="$(_aws_pick "Source profile" "${profiles[@]}")"
  [[ -z "$source_profile" ]] && return 1

  session_profile="$source_profile-mfa"

  echo "Fetching MFA devices for $source_profile..."
  mfa_devices=("${(@f)$(aws iam list-mfa-devices \
    --profile "$source_profile" \
    --query 'MFADevices[].SerialNumber' --output text 2>/dev/null | tr '\t' '\n')}")
  if [[ ${#mfa_devices[@]} -eq 0 || -z "${mfa_devices[1]}" ]]; then
    echo "no MFA devices visible for profile $source_profile"
    return 1
  fi

  if [[ ${#mfa_devices[@]} -eq 1 ]]; then
    mfa_serial="${mfa_devices[1]}"
    printf 'MFA device: %s\n' "$mfa_serial"
  else
    mfa_serial="$(_aws_pick "MFA device" "${mfa_devices[@]}")"
    [[ -z "$mfa_serial" ]] && return 1
  fi

  read -r "token_code?MFA code: "
  if [[ -z "$token_code" ]]; then
    echo "MFA code is required"
    return 1
  fi

  if [[ ! "$token_code" =~ '^[0-9]{6}$' ]]; then
    echo "MFA code must be 6 digits"
    return 1
  fi

  read -r "duration?Duration seconds [43200]: "
  duration="${duration:-43200}"

  if [[ ! "$duration" =~ '^[0-9]+$' ]]; then
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
