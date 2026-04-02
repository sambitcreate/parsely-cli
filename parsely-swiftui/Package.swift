// swift-tools-version: 5.9
import PackageDescription

// Requires macOS 26 (Tahoe) or iOS 26 for WebKit.WebPage / WebView.
// Open this package in Xcode 17+ and run on a macOS 26 target.
let package = Package(
    name: "Parsely",
    platforms: [
        .macOS(.v26),
        .iOS(.v26),
    ],
    targets: [
        .target(
            name: "Parsely",
            path: "Sources/Parsely"
        )
    ]
)
