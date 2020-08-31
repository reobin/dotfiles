# macOS: Makes dock autohide animation instant
defaults write com.apple.dock autohide-time-modifier -int 0; killall Dock
defaults write com.apple.Dock autohide-delay -float 0.0001; killall Dock
