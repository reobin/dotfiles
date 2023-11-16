# GPG sign commits

1. Install GPG suite: `brew install gpg-suite`
2. Generate a key: `gpg --full-generate-key`
3. Choose default options: RSA, 3072, 0
4. Choose a passphrase and save it safely
5. List keys: `gpg --list-secret-keys --keyid-format LONG`
6. Copy the key ID (the part after `rsa3072/`)
7. Add the key ID to your git config: `git config --global user.signingkey <key ID>`
8. Add the GPG key to [your GitHub account](https://github.com/settings/keys)
