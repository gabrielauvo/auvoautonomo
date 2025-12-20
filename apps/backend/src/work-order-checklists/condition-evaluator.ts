import { ItemCondition, ConditionOperator } from '../checklist-templates/dto/checklist-item-type.enum';

export class ConditionEvaluator {
  /**
   * Evaluates if a condition is met based on existing answers
   * @param condition The condition to evaluate
   * @param answersMap Map of templateItemId -> answer value
   * @returns true if condition is met, false otherwise
   */
  static evaluate(condition: ItemCondition | null | undefined, answersMap: Map<string, any>): boolean {
    if (!condition) {
      return true; // No condition means always visible
    }

    // Compound condition (AND/OR)
    if (condition.logic && condition.conditions) {
      if (condition.logic === 'AND') {
        return condition.conditions.every((subCondition) =>
          this.evaluate(subCondition, answersMap),
        );
      } else if (condition.logic === 'OR') {
        return condition.conditions.some((subCondition) =>
          this.evaluate(subCondition, answersMap),
        );
      }
    }

    // Simple condition
    if (!condition.dependsOnItemId || !condition.operator) {
      return true;
    }

    const dependentValue = answersMap.get(condition.dependsOnItemId);

    // If dependent question is not answered, condition is not met
    if (dependentValue === undefined || dependentValue === null) {
      return false;
    }

    return this.evaluateOperator(
      condition.operator,
      dependentValue,
      condition.value,
    );
  }

  private static evaluateOperator(
    operator: ConditionOperator,
    actualValue: any,
    expectedValue: any,
  ): boolean {
    switch (operator) {
      case ConditionOperator.EQUALS:
        return actualValue === expectedValue;

      case ConditionOperator.NOT_EQUALS:
        return actualValue !== expectedValue;

      case ConditionOperator.GREATER_THAN:
        return Number(actualValue) > Number(expectedValue);

      case ConditionOperator.LESS_THAN:
        return Number(actualValue) < Number(expectedValue);

      case ConditionOperator.GREATER_THAN_OR_EQUAL:
        return Number(actualValue) >= Number(expectedValue);

      case ConditionOperator.LESS_THAN_OR_EQUAL:
        return Number(actualValue) <= Number(expectedValue);

      case ConditionOperator.IN:
        if (!Array.isArray(expectedValue)) {
          return false;
        }
        return expectedValue.includes(actualValue);

      case ConditionOperator.NOT_IN:
        if (!Array.isArray(expectedValue)) {
          return true;
        }
        return !expectedValue.includes(actualValue);

      default:
        return false;
    }
  }

  /**
   * Extract the answer value based on item type
   */
  static extractAnswerValue(answer: any): any {
    if (!answer) return null;

    // Extract based on type
    if (answer.valueBoolean !== null && answer.valueBoolean !== undefined) {
      return answer.valueBoolean;
    }
    if (answer.valueNumber !== null && answer.valueNumber !== undefined) {
      return Number(answer.valueNumber);
    }
    if (answer.valueText) {
      return answer.valueText;
    }
    if (answer.valueSelect) {
      return answer.valueSelect;
    }
    if (answer.valuePhoto) {
      return answer.valuePhoto;
    }

    return null;
  }
}
