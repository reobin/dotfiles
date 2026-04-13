# QMK Keymap

## Edit the keymap

1. Open [config.qmk.fm](https://config.qmk.fm)
2. Click **Import QMK Keymap JSON**
3. Select the JSON file
4. Make changes and export

## Compile

```sh
qmk compile <keymap.json>
```

## Flash to keyboard

1. Hold the top left key and reconnect the keyboard to enter bootloader mode
2. The keyboard will appear as a USB drive
3. Drop the compiled firmware file into it using a file explorer
