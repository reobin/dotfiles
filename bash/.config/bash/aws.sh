aws-refresh-mfa() {
  if ! command -v aws >/dev/null 2>&1; then
    echo "aws CLI is required"
    return 1
  fi

  local source_profile session_profile device_name token_code duration account_id region creds
  local access_key secret_key session_token expiration

  read -r -p "AWS source profile: " source_profile
  if [[ -z "$source_profile" ]]; then
    echo "source profile is required"
    return 1
  fi

  read -r -p "Session profile [$source_profile-mfa]: " session_profile
  session_profile="${session_profile:-$source_profile-mfa}"

  read -r -p "MFA device name: " device_name
  if [[ -z "$device_name" ]]; then
    echo "MFA device name is required"
    return 1
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

  account_id="$(aws sts get-caller-identity --profile "$source_profile" --query 'Account' --output text)" || return 1
  region="$(aws configure get region --profile "$source_profile")"

  creds="$(aws sts get-session-token \
    --profile "$source_profile" \
    --serial-number "arn:aws:iam::${account_id}:mfa/${device_name}" \
    --token-code "$token_code" \
    --duration-seconds "$duration" \
    --query 'Credentials.[AccessKeyId,SecretAccessKey,SessionToken,Expiration]' \
    --output text)" || return 1

  read -r access_key secret_key session_token expiration <<<"$creds"

  aws configure set aws_access_key_id "$access_key" --profile "$session_profile"
  aws configure set aws_secret_access_key "$secret_key" --profile "$session_profile"
  aws configure set aws_session_token "$session_token" --profile "$session_profile"

  if [[ -n "$region" ]]; then
    aws configure set region "$region" --profile "$session_profile"
  fi

  printf 'Refreshed %s until %s\n' "$session_profile" "$expiration"
}
