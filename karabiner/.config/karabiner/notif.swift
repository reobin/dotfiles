import AppKit
import ApplicationServices

// notif open|dismiss|dismiss-all: act on the topmost Notification Center banner.
let usage = "usage: notif open|dismiss|dismiss-all"
guard CommandLine.arguments.count == 2 else {
  FileHandle.standardError.write((usage + "\n").data(using: .utf8)!)
  exit(2)
}
let command = CommandLine.arguments[1]

let promptKey = kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String
guard AXIsProcessTrustedWithOptions([promptKey: true] as CFDictionary) else {
  FileHandle.standardError.write("notif: needs Accessibility permission\n".data(using: .utf8)!)
  exit(1)
}

guard let center = NSWorkspace.shared.runningApplications.first(where: {
  $0.bundleIdentifier == "com.apple.notificationcenterui"
}) else { exit(0) }
let root = AXUIElementCreateApplication(center.processIdentifier)

func children(_ element: AXUIElement) -> [AXUIElement] {
  var value: AnyObject?
  guard AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &value) == .success else { return [] }
  return value as? [AXUIElement] ?? []
}

func actions(_ element: AXUIElement) -> [String] {
  var names: CFArray?
  guard AXUIElementCopyActionNames(element, &names) == .success else { return [] }
  return names as? [String] ?? []
}

// Custom actions are named "Name:Close\nTarget:0x0\nSelector:(null)".
func action(_ element: AXUIElement, named name: String) -> String? {
  actions(element).first { $0 == name || $0.hasPrefix("Name:\(name)\n") }
}

// Banners and collapsed stacks are the elements that can be closed; the tree
// above them changes shape between macOS releases, so search rather than walk a path.
func banners(_ element: AXUIElement) -> [AXUIElement] {
  if action(element, named: "Close") != nil { return [element] }
  return children(element).flatMap(banners)
}

func perform(_ element: AXUIElement, _ name: String) {
  AXUIElementPerformAction(element, name as CFString)
}

switch command {
case "open":
  if let top = banners(root).first { perform(top, kAXPressAction) }
case "dismiss":
  if let top = banners(root).first, let close = action(top, named: "Close") { perform(top, close) }
case "dismiss-all":
  for _ in 0..<50 {
    guard let top = banners(root).first else { break }
    perform(top, action(top, named: "Clear All") ?? action(top, named: "Close")!)
    usleep(150_000)
  }
default:
  FileHandle.standardError.write((usage + "\n").data(using: .utf8)!)
  exit(2)
}
