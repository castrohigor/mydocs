//
//  ShareViewController.swift — Share Extension do MyDocs
//
//  Recebe arquivos do menu "Compartilhar" do iOS, copia para o App Group
//  compartilhado com o app e abre o MyDocs (mydocs://share), onde o plugin
//  @capgo/capacitor-share-target entrega os arquivos ao JavaScript.
//
//  Como adicionar ao projeto: veja docs/ios-share-extension.md
//

import UIKit
import UniformTypeIdentifiers

class ShareViewController: UIViewController {

    // Precisa ser igual ao App Group do Xcode e ao appGroupId do capacitor.config.ts
    private let appGroupId = "group.com.mydocs.app"
    private let appURL = URL(string: "mydocs://share")!

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        Task { await handleShare() }
    }

    private func handleShare() async {
        guard
            let items = extensionContext?.inputItems as? [NSExtensionItem],
            let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId)
        else {
            return finish()
        }

        let dir = container.appendingPathComponent("shared", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)

        var files: [[String: Any]] = []
        var texts: [String] = []

        for item in items {
            for provider in item.attachments ?? [] {
                if let file = await copyFile(from: provider, to: dir) {
                    files.append(file)
                } else if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier),
                          let url = try? await provider.loadItem(forTypeIdentifier: UTType.url.identifier) as? URL {
                    texts.append(url.absoluteString)
                } else if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier),
                          let text = try? await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) as? String {
                    texts.append(text)
                }
            }
        }

        let defaults = UserDefaults(suiteName: appGroupId)
        defaults?.set(["title": "", "texts": texts, "files": files], forKey: "share-target-data")
        defaults?.synchronize()

        await MainActor.run { openHostApp() }
        finish()
    }

    /// Copia o anexo para o container do App Group e devolve {uri, name, mimeType}.
    private func copyFile(from provider: NSItemProvider, to dir: URL) async -> [String: Any]? {
        let candidates: [UTType] = [.pdf, .image, .spreadsheet, .commaSeparatedText, .data]
        guard let type = candidates.first(where: { provider.hasItemConformingToTypeIdentifier($0.identifier) }) else {
            return nil
        }

        return await withCheckedContinuation { continuation in
            provider.loadFileRepresentation(forTypeIdentifier: type.identifier) { url, _ in
                guard let url else { return continuation.resume(returning: nil) }
                let name = provider.suggestedName.map { name -> String in
                    url.pathExtension.isEmpty || name.hasSuffix(".\(url.pathExtension)") ? name : "\(name).\(url.pathExtension)"
                } ?? url.lastPathComponent
                let dest = dir.appendingPathComponent("\(UUID().uuidString)-\(name)")
                do {
                    try FileManager.default.copyItem(at: url, to: dest)
                } catch {
                    return continuation.resume(returning: nil)
                }
                let mime = UTType(filenameExtension: dest.pathExtension)?.preferredMIMEType
                    ?? type.preferredMIMEType
                    ?? "application/octet-stream"
                continuation.resume(returning: ["uri": dest.absoluteString, "name": name, "mimeType": mime])
            }
        }
    }

    /// Extensões não podem chamar UIApplication.shared; subimos a cadeia de responders.
    private func openHostApp() {
        var responder: UIResponder? = self
        while let r = responder {
            if let app = r as? UIApplication {
                app.open(appURL, options: [:], completionHandler: nil)
                return
            }
            responder = r.next
        }
    }

    private func finish() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
}
