export function parsePrice(text: string): number {
 const price = parseInt(text.replace(/\D/g, ''), 10);
 return price;
}