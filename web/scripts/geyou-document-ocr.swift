import Foundation
import Vision
import ImageIO

// Local recognition only. Caller deletes the temporary image after this process exits.
do {
    guard CommandLine.arguments.count == 2 else { throw NSError(domain: "input", code: 1) }
    let url = URL(fileURLWithPath: CommandLine.arguments[1])
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["zh-Hans", "en-US"]
    request.usesLanguageCorrection = false
    try VNImageRequestHandler(url: url, options: [:]).perform([request])
    let observations = (request.results ?? []).sorted {
        let y = $0.boundingBox.midY - $1.boundingBox.midY
        return abs(y) > 0.015 ? y > 0 : $0.boundingBox.minX < $1.boundingBox.minX
    }
    let lines = observations.compactMap { $0.topCandidates(1).first }
        .filter { $0.confidence >= 0.35 }.map { $0.string }
    let data = try JSONSerialization.data(withJSONObject: lines)
    FileHandle.standardOutput.write(data)
} catch {
    FileHandle.standardError.write(Data("recognition_failed".utf8))
    exit(1)
}
