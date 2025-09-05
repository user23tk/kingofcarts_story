const KING = 'King of Carts';

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function render(text: string, player: string) {
  return escapeHtml(text.replace(/{{KING}}/g, KING).replace(/{{PLAYER}}/g, player));
}
