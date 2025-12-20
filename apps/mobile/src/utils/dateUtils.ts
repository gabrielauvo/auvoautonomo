/**
 * Date Utilities
 *
 * Funções utilitárias para manipulação de datas no timezone local.
 * Evita problemas com conversão UTC que causa datas erradas.
 */

/**
 * Formata uma data no timezone local como YYYY-MM-DD
 * Evita o problema de toISOString() que converte para UTC
 *
 * @example
 * const date = new Date('2025-12-17T00:00:00'); // Meia-noite local
 * formatLocalDate(date) // "2025-12-17" (sempre a data local)
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formata uma data/hora no timezone local como YYYY-MM-DDTHH:mm:ss
 * Evita o problema de toISOString() que converte para UTC
 *
 * @example
 * const date = new Date('2025-12-17T14:30:00'); // 14:30 local
 * formatLocalDateTime(date) // "2025-12-17T14:30:00" (sempre a hora local)
 */
export function formatLocalDateTime(date: Date): string {
  const localDate = formatLocalDate(date);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${localDate}T${hours}:${minutes}:${seconds}`;
}

/**
 * Retorna a data de hoje no formato YYYY-MM-DD (timezone local)
 */
export function getTodayLocalDate(): string {
  return formatLocalDate(new Date());
}

/**
 * Extrai a parte da data (YYYY-MM-DD) de uma string ISO ou datetime
 * Funciona tanto com "2025-12-17" quanto "2025-12-17T21:00:00.000Z"
 */
export function extractDatePart(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  return dateStr.split('T')[0];
}

/**
 * Compara duas datas (apenas a parte da data, ignorando hora)
 * @returns -1 se date1 < date2, 0 se iguais, 1 se date1 > date2
 */
export function compareDates(date1: Date | string, date2: Date | string): number {
  const d1 = typeof date1 === 'string' ? extractDatePart(date1) : formatLocalDate(date1);
  const d2 = typeof date2 === 'string' ? extractDatePart(date2) : formatLocalDate(date2);

  if (!d1 || !d2) return 0;
  if (d1 < d2) return -1;
  if (d1 > d2) return 1;
  return 0;
}

/**
 * Verifica se uma data é hoje (timezone local)
 */
export function isToday(date: Date | string): boolean {
  const today = getTodayLocalDate();
  const dateStr = typeof date === 'string' ? extractDatePart(date) : formatLocalDate(date);
  return dateStr === today;
}

/**
 * Verifica se uma data é anterior a hoje (timezone local)
 */
export function isBeforeToday(date: Date | string): boolean {
  const today = getTodayLocalDate();
  const dateStr = typeof date === 'string' ? extractDatePart(date) : formatLocalDate(date);
  return dateStr !== null && dateStr < today;
}

/**
 * Verifica se uma data é posterior a hoje (timezone local)
 */
export function isAfterToday(date: Date | string): boolean {
  const today = getTodayLocalDate();
  const dateStr = typeof date === 'string' ? extractDatePart(date) : formatLocalDate(date);
  return dateStr !== null && dateStr > today;
}

/**
 * Cria uma data a partir de uma string YYYY-MM-DD no timezone local
 * Diferente de new Date("YYYY-MM-DD") que pode interpretar como UTC
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Adiciona dias a uma data (retorna nova Date)
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Formata data para exibição no formato brasileiro
 */
export function formatDateBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR');
}

/**
 * Formata data e hora para exibição no formato brasileiro
 */
export function formatDateTimeBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('pt-BR');
}

/**
 * Formata apenas hora para exibição (HH:mm)
 */
export function formatTimeBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
