import Foundation

struct Recipe: Sendable {
    let name: String
    let description: String?
    let prepTime: Int?       // minutes
    let cookTime: Int?       // minutes
    let totalTime: Int?      // minutes
    let servings: String?
    let ingredients: [String]
    let instructions: [String]
    let nutrition: NutritionInfo?
    let source: Source

    enum Source: Sendable {
        case browser, ai
    }

    struct NutritionInfo: Sendable {
        let calories: String?
        let fat: String?
        let protein: String?
        let carbohydrates: String?
        let fiber: String?
        let sugar: String?
        let sodium: String?

        var isEmpty: Bool {
            [calories, fat, protein, carbohydrates, fiber, sugar, sodium]
                .allSatisfy { $0 == nil || $0!.isEmpty }
        }
    }
}
