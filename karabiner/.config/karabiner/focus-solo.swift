import AppKit

// focus-solo <Application Name>: focus the app, then hide everything else.
let arguments = CommandLine.arguments
guard arguments.count >= 2 else { exit(1) }
let target = arguments[1]
let dryRun = arguments.count >= 3 && arguments[2] == "--dry-run"

func isTarget(_ app: NSRunningApplication) -> Bool {
  app.localizedName?.localizedCaseInsensitiveCompare(target) == .orderedSame
}

func findTarget() -> NSRunningApplication? {
  NSWorkspace.shared.runningApplications.first { !$0.isTerminated && isTarget($0) }
}

func activate(_ app: NSRunningApplication) {
  app.unhide()
  if let url = app.bundleURL {
    let config = NSWorkspace.OpenConfiguration()
    config.activates = true
    NSWorkspace.shared.openApplication(at: url, configuration: config, completionHandler: nil)
  } else {
    _ = app.activate(options: [.activateAllWindows])
  }
}

func waitActive(_ app: NSRunningApplication, timeout: TimeInterval) {
  let deadline = Date().addingTimeInterval(timeout)
  while !app.isActive && Date() < deadline {
    RunLoop.main.run(until: Date().addingTimeInterval(0.02))
  }
}

if dryRun {
  if let app = findTarget() { print(app.localizedName ?? target) }
  exit(0)
}

var app = findTarget()
if app == nil {
  let url = URL(fileURLWithPath: "/Applications/\(target).app")
  if FileManager.default.fileExists(atPath: url.path) {
    NSWorkspace.shared.openApplication(at: url, configuration: NSWorkspace.OpenConfiguration(), completionHandler: nil)
    // The launch only dispatches while the run loop is pumped, so spin it
    // until the app exists and has finished launching.
    let deadline = Date().addingTimeInterval(5)
    while Date() < deadline {
      RunLoop.main.run(until: Date().addingTimeInterval(0.1))
      if let match = findTarget(), match.isFinishedLaunching {
        app = match
        break
      }
    }
  }
}

guard let app else { exit(0) }
activate(app)
// Hiding the previous frontmost app before activation lands promotes Finder,
// so wait until the target owns the menu bar first.
waitActive(app, timeout: 0.5)
for other in NSWorkspace.shared.runningApplications where other.activationPolicy == .regular && other.isFinishedLaunching && !other.isTerminated && !isTarget(other) {
  other.hide()
}
if !app.isActive {
  activate(app)
  waitActive(app, timeout: 0.5)
}
