const A_CHAR_CODE = 65;

export function getChoiceLabel(index: number): string {
  return String.fromCharCode(A_CHAR_CODE + index);
}
