# GPG sign commits

1. Install GPG suite: `brew install gpg-suite`
1. Generate a key: `gpg --full-generate-key`
1. Choose default options: RSA, 3072, 0
1. Choose a passphrase and save it safely
1. List keys: `gpg --list-secret-keys --keyid-format LONG`
1. Copy the key ID (the part after `rsa3072/`)
1. Add the key ID to your git config: `git config --global user.signingkey <key ID>`
1. Output the public key: `gpg --armor --export <key ID>`
1. Add the public key to [your GitHub account](https://github.com/settings/keys)
