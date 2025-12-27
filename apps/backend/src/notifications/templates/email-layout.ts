/**
 * Professional Email Layout System
 *
 * Design system for Auvo Autonomo email templates.
 * Uses inline CSS for maximum email client compatibility.
 *
 * Design Principles:
 * - Clean, minimal aesthetic with generous whitespace
 * - Brand colors (purple gradient) as accent
 * - Mobile-first responsive design
 * - Dark mode support via prefers-color-scheme
 * - Accessibility: good contrast ratios, readable fonts
 */

// =============================================================================
// DESIGN TOKENS
// =============================================================================

export const colors = {
  // Brand
  primary: {
    50: '#F5F3FF',
    100: '#EDE9FE',
    200: '#DDD6FE',
    300: '#C4B5FD',
    400: '#A78BFA',
    500: '#8B5CF6',
    600: '#7C3AED',
    700: '#6D28D9',
    800: '#5B21B6',
    900: '#4C1D95',
  },

  // Semantic
  success: {
    50: '#ECFDF5',
    100: '#D1FAE5',
    500: '#10B981',
    600: '#059669',
    700: '#047857',
  },
  warning: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
  },
  error: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
  },
  info: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    500: '#3B82F6',
    600: '#2563EB',
    700: '#1D4ED8',
  },

  // Neutrals
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },

  white: '#FFFFFF',
  black: '#000000',
};

export const fonts = {
  primary:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
};

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
  '3xl': '64px',
};

export const borderRadius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
};

// =============================================================================
// EMAIL TYPE CONFIGURATION
// =============================================================================

export type EmailType =
  | 'quote_sent'
  | 'quote_approved'
  | 'quote_rejected'
  | 'quote_follow_up'
  | 'work_order_created'
  | 'work_order_completed'
  | 'payment_created'
  | 'payment_confirmed'
  | 'payment_overdue'
  | 'payment_reminder_before'
  | 'payment_reminder_after'
  | 'welcome'
  | 'password_reset';

export interface EmailTypeConfig {
  accentColor: string;
  accentColorLight: string;
  icon: string;
  iconBg: string;
}

export const emailTypeConfig: Record<EmailType, EmailTypeConfig> = {
  quote_sent: {
    accentColor: colors.primary[600],
    accentColorLight: colors.primary[50],
    icon: '📋',
    iconBg: colors.primary[100],
  },
  quote_approved: {
    accentColor: colors.success[600],
    accentColorLight: colors.success[50],
    icon: '✅',
    iconBg: colors.success[100],
  },
  quote_rejected: {
    accentColor: colors.error[600],
    accentColorLight: colors.error[50],
    icon: '❌',
    iconBg: colors.error[100],
  },
  quote_follow_up: {
    accentColor: colors.primary[600],
    accentColorLight: colors.primary[50],
    icon: '🔔',
    iconBg: colors.primary[100],
  },
  work_order_created: {
    accentColor: colors.info[600],
    accentColorLight: colors.info[50],
    icon: '📅',
    iconBg: colors.info[100],
  },
  work_order_completed: {
    accentColor: colors.success[600],
    accentColorLight: colors.success[50],
    icon: '🎉',
    iconBg: colors.success[100],
  },
  payment_created: {
    accentColor: colors.primary[600],
    accentColorLight: colors.primary[50],
    icon: '💳',
    iconBg: colors.primary[100],
  },
  payment_confirmed: {
    accentColor: colors.success[600],
    accentColorLight: colors.success[50],
    icon: '✓',
    iconBg: colors.success[100],
  },
  payment_overdue: {
    accentColor: colors.error[600],
    accentColorLight: colors.error[50],
    icon: '⚠️',
    iconBg: colors.error[100],
  },
  payment_reminder_before: {
    accentColor: colors.warning[600],
    accentColorLight: colors.warning[50],
    icon: '⏰',
    iconBg: colors.warning[100],
  },
  payment_reminder_after: {
    accentColor: colors.error[600],
    accentColorLight: colors.error[50],
    icon: '🚨',
    iconBg: colors.error[100],
  },
  welcome: {
    accentColor: colors.primary[600],
    accentColorLight: colors.primary[50],
    icon: '👋',
    iconBg: colors.primary[100],
  },
  password_reset: {
    accentColor: colors.primary[600],
    accentColorLight: colors.primary[50],
    icon: '🔐',
    iconBg: colors.primary[100],
  },
};

// =============================================================================
// LAYOUT COMPONENTS
// =============================================================================

export interface LayoutOptions {
  companyName?: string;
  companyLogo?: string;
  supportEmail?: string;
  unsubscribeUrl?: string;
  previewText?: string;
}

/**
 * Base email wrapper with consistent styling
 */
export function emailWrapper(
  content: string,
  options: LayoutOptions = {},
): string {
  const {
    companyName = 'Auvo Autônomo',
    supportEmail = 'suporte@auvoautonomo.com',
    previewText = '',
  } = options;

  const year = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="pt-BR" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${companyName}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset */
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      height: 100% !important;
    }
    a[x-apple-data-detectors] {
      color: inherit !important;
      text-decoration: none !important;
      font-size: inherit !important;
      font-family: inherit !important;
      font-weight: inherit !important;
      line-height: inherit !important;
    }

    /* Responsive */
    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
      }
      .fluid {
        max-width: 100% !important;
        height: auto !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }
      .stack-column {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        direction: ltr !important;
      }
      .center-on-narrow {
        text-align: center !important;
        display: block !important;
        margin-left: auto !important;
        margin-right: auto !important;
        float: none !important;
      }
      .padding-mobile {
        padding-left: 16px !important;
        padding-right: 16px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; word-spacing: normal; background-color: ${colors.gray[100]};">
  ${previewText ? `<div style="display: none; max-height: 0; overflow: hidden;">${previewText}</div>` : ''}
  <div role="article" aria-roledescription="email" lang="pt-BR" style="text-size-adjust: 100%; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: ${colors.gray[100]};">
    <table role="presentation" style="width: 100%; border: none; border-spacing: 0;">
      <tr>
        <td align="center" style="padding: ${spacing.xl} ${spacing.md};">
          <!--[if mso]>
          <table role="presentation" align="center" style="width: 600px;">
          <tr>
          <td>
          <![endif]-->
          <table role="presentation" class="email-container" style="margin: 0 auto; width: 100%; max-width: 600px; border: none; border-spacing: 0; text-align: left; background-color: ${colors.white}; border-radius: ${borderRadius.lg}; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
            ${content}

            <!-- Footer -->
            <tr>
              <td style="padding: ${spacing.lg} ${spacing.xl}; background-color: ${colors.gray[50]}; border-top: 1px solid ${colors.gray[200]};">
                <table role="presentation" style="width: 100%; border: none; border-spacing: 0;">
                  <tr>
                    <td style="text-align: center;">
                      <p style="margin: 0 0 ${spacing.sm}; font-family: ${fonts.primary}; font-size: 13px; line-height: 1.5; color: ${colors.gray[500]};">
                        © ${year} ${companyName}. Todos os direitos reservados.
                      </p>
                      <p style="margin: 0; font-family: ${fonts.primary}; font-size: 12px; line-height: 1.5; color: ${colors.gray[400]};">
                        Dúvidas? Entre em contato: <a href="mailto:${supportEmail}" style="color: ${colors.primary[600]}; text-decoration: none;">${supportEmail}</a>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <!--[if mso]>
          </td>
          </tr>
          </table>
          <![endif]-->
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
`;
}

/**
 * Header section with gradient and logo/title
 */
export function emailHeader(
  title: string,
  emailType: EmailType,
  subtitle?: string,
): string {
  const config = emailTypeConfig[emailType];

  return `
    <!-- Header -->
    <tr>
      <td style="padding: 0;">
        <table role="presentation" style="width: 100%; border: none; border-spacing: 0;">
          <!-- Brand Bar -->
          <tr>
            <td style="padding: ${spacing.lg} ${spacing.xl}; background: linear-gradient(135deg, ${colors.primary[600]} 0%, ${colors.primary[800]} 100%);">
              <table role="presentation" style="width: 100%; border: none; border-spacing: 0;">
                <tr>
                  <td style="text-align: center;">
                    <span style="font-family: ${fonts.primary}; font-size: 24px; font-weight: 700; color: ${colors.white}; letter-spacing: -0.5px;">
                      Auvo Autônomo
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Icon + Title -->
          <tr>
            <td style="padding: ${spacing.xl} ${spacing.xl} ${spacing.lg};">
              <table role="presentation" style="width: 100%; border: none; border-spacing: 0;">
                <tr>
                  <td style="text-align: center;">
                    <!-- Icon Badge -->
                    <div style="display: inline-block; width: 64px; height: 64px; line-height: 64px; font-size: 28px; background-color: ${config.iconBg}; border-radius: ${borderRadius.full}; margin-bottom: ${spacing.md};">
                      ${config.icon}
                    </div>

                    <!-- Title -->
                    <h1 style="margin: 0 0 ${subtitle ? spacing.xs : '0'}; font-family: ${fonts.primary}; font-size: 24px; font-weight: 700; color: ${colors.gray[900]}; line-height: 1.3;">
                      ${title}
                    </h1>

                    ${
                      subtitle
                        ? `
                    <p style="margin: 0; font-family: ${fonts.primary}; font-size: 15px; color: ${colors.gray[500]};">
                      ${subtitle}
                    </p>
                    `
                        : ''
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

/**
 * Content section wrapper
 */
export function emailContent(content: string): string {
  return `
    <!-- Content -->
    <tr>
      <td class="padding-mobile" style="padding: 0 ${spacing.xl} ${spacing.xl};">
        ${content}
      </td>
    </tr>
  `;
}

/**
 * Greeting paragraph
 */
export function greeting(name: string): string {
  return `
    <p style="margin: 0 0 ${spacing.md}; font-family: ${fonts.primary}; font-size: 16px; line-height: 1.6; color: ${colors.gray[700]};">
      Olá, <strong style="color: ${colors.gray[900]};">${name}</strong>!
    </p>
  `;
}

/**
 * Regular paragraph
 */
export function paragraph(text: string): string {
  return `
    <p style="margin: 0 0 ${spacing.md}; font-family: ${fonts.primary}; font-size: 15px; line-height: 1.7; color: ${colors.gray[600]};">
      ${text}
    </p>
  `;
}

/**
 * Info card with details
 */
export interface InfoCardItem {
  label: string;
  value: string;
  highlight?: boolean;
}

export function infoCard(
  items: InfoCardItem[],
  variant: 'default' | 'success' | 'warning' | 'error' = 'default',
): string {
  const bgColors = {
    default: colors.gray[50],
    success: colors.success[50],
    warning: colors.warning[50],
    error: colors.error[50],
  };

  const borderColors = {
    default: colors.gray[200],
    success: colors.success[500],
    warning: colors.warning[500],
    error: colors.error[500],
  };

  return `
    <table role="presentation" style="width: 100%; border: none; border-spacing: 0; margin: ${spacing.md} 0 ${spacing.lg};">
      <tr>
        <td style="padding: ${spacing.lg}; background-color: ${bgColors[variant]}; border-radius: ${borderRadius.md}; border-left: 4px solid ${borderColors[variant]};">
          <table role="presentation" style="width: 100%; border: none; border-spacing: 0;">
            ${items
              .map(
                (item, index) => `
              <tr>
                <td style="padding: ${index === 0 ? '0' : spacing.xs} 0 0; font-family: ${fonts.primary}; font-size: 14px; color: ${colors.gray[500]};">
                  ${item.label}
                </td>
              </tr>
              <tr>
                <td style="padding: 2px 0 ${index === items.length - 1 ? '0' : spacing.sm}; font-family: ${fonts.primary}; font-size: ${item.highlight ? '20px' : '15px'}; font-weight: ${item.highlight ? '700' : '600'}; color: ${colors.gray[900]};">
                  ${item.value}
                </td>
              </tr>
            `,
              )
              .join('')}
          </table>
        </td>
      </tr>
    </table>
  `;
}

/**
 * PIX payment block
 */
export interface PixInfo {
  pixKey: string;
  pixKeyType?: string;
  pixKeyOwnerName?: string;
}

export function pixBlock(pix: PixInfo): string {
  const typeLabels: Record<string, string> = {
    CPF: 'CPF',
    CNPJ: 'CNPJ',
    EMAIL: 'E-mail',
    PHONE: 'Telefone',
    RANDOM: 'Chave aleatória',
  };

  const typeLabel = pix.pixKeyType ? typeLabels[pix.pixKeyType] || pix.pixKeyType : '';

  return `
    <table role="presentation" style="width: 100%; border: none; border-spacing: 0; margin: ${spacing.md} 0 ${spacing.lg};">
      <tr>
        <td style="padding: ${spacing.lg}; background-color: ${colors.info[50]}; border-radius: ${borderRadius.md}; border-left: 4px solid ${colors.info[500]};">
          <table role="presentation" style="width: 100%; border: none; border-spacing: 0;">
            <tr>
              <td style="padding-bottom: ${spacing.sm};">
                <span style="font-family: ${fonts.primary}; font-size: 15px; font-weight: 700; color: ${colors.info[700]};">
                  📱 PIX para pagamento
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: ${spacing.sm} 0;">
                <span style="font-family: ${fonts.primary}; font-size: 13px; color: ${colors.gray[500]};">Chave:</span>
                <br>
                <code style="font-family: ${fonts.mono}; font-size: 14px; font-weight: 600; color: ${colors.gray[800]}; background-color: ${colors.white}; padding: ${spacing.xs} ${spacing.sm}; border-radius: ${borderRadius.sm}; display: inline-block; margin-top: 4px; word-break: break-all;">
                  ${pix.pixKey}
                </code>
              </td>
            </tr>
            ${
              typeLabel
                ? `
            <tr>
              <td style="padding: ${spacing.xs} 0;">
                <span style="font-family: ${fonts.primary}; font-size: 13px; color: ${colors.gray[500]};">Tipo: </span>
                <span style="font-family: ${fonts.primary}; font-size: 14px; color: ${colors.gray[700]};">${typeLabel}</span>
              </td>
            </tr>
            `
                : ''
            }
            ${
              pix.pixKeyOwnerName
                ? `
            <tr>
              <td style="padding: ${spacing.xs} 0;">
                <span style="font-family: ${fonts.primary}; font-size: 13px; color: ${colors.gray[500]};">Favorecido: </span>
                <span style="font-family: ${fonts.primary}; font-size: 14px; font-weight: 500; color: ${colors.gray[700]};">${pix.pixKeyOwnerName}</span>
              </td>
            </tr>
            `
                : ''
            }
            <tr>
              <td style="padding-top: ${spacing.sm};">
                <span style="font-family: ${fonts.primary}; font-size: 12px; color: ${colors.gray[400]};">
                  Copie a chave e cole no seu banco para pagar via Pix.
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Primary CTA button
 */
export function button(
  text: string,
  url: string,
  variant: 'primary' | 'success' | 'warning' | 'error' = 'primary',
): string {
  const bgColors = {
    primary: colors.primary[600],
    success: colors.success[600],
    warning: colors.warning[600],
    error: colors.error[600],
  };

  const hoverColors = {
    primary: colors.primary[700],
    success: colors.success[700],
    warning: colors.warning[700],
    error: colors.error[700],
  };

  return `
    <table role="presentation" style="width: 100%; border: none; border-spacing: 0; margin: ${spacing.lg} 0;">
      <tr>
        <td style="text-align: center;">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height: 48px; v-text-anchor: middle; width: 220px;" arcsize="17%" stroke="f" fillcolor="${bgColors[variant]}">
            <w:anchorlock/>
            <center style="color: #ffffff; font-family: sans-serif; font-size: 16px; font-weight: bold;">
              ${text}
            </center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a href="${url}" target="_blank" style="display: inline-block; padding: 14px 32px; font-family: ${fonts.primary}; font-size: 16px; font-weight: 600; color: ${colors.white}; text-decoration: none; background-color: ${bgColors[variant]}; border-radius: ${borderRadius.md}; transition: background-color 0.2s;">
            ${text}
          </a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>
  `;
}

/**
 * Secondary link
 */
export function link(text: string, url: string): string {
  return `<a href="${url}" target="_blank" style="color: ${colors.primary[600]}; text-decoration: none; font-weight: 500;">${text}</a>`;
}

/**
 * Code/PIX code block
 */
export function codeBlock(code: string, label?: string): string {
  return `
    <table role="presentation" style="width: 100%; border: none; border-spacing: 0; margin: ${spacing.md} 0;">
      <tr>
        <td>
          ${
            label
              ? `
          <span style="font-family: ${fonts.primary}; font-size: 12px; color: ${colors.gray[500]}; display: block; margin-bottom: ${spacing.xs};">
            ${label}
          </span>
          `
              : ''
          }
          <div style="padding: ${spacing.md}; background-color: ${colors.gray[100]}; border-radius: ${borderRadius.md}; overflow-x: auto;">
            <code style="font-family: ${fonts.mono}; font-size: 12px; color: ${colors.gray[700]}; word-break: break-all; white-space: pre-wrap;">
              ${code}
            </code>
          </div>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Divider line
 */
export function divider(): string {
  return `
    <table role="presentation" style="width: 100%; border: none; border-spacing: 0; margin: ${spacing.lg} 0;">
      <tr>
        <td style="border-top: 1px solid ${colors.gray[200]}; font-size: 1px; line-height: 1px;">
          &nbsp;
        </td>
      </tr>
    </table>
  `;
}

/**
 * Callout/Note box
 */
export function callout(
  text: string,
  variant: 'info' | 'warning' | 'success' = 'info',
): string {
  const config = {
    info: { bg: colors.info[50], border: colors.info[500], icon: 'ℹ️' },
    warning: { bg: colors.warning[50], border: colors.warning[500], icon: '⚠️' },
    success: { bg: colors.success[50], border: colors.success[500], icon: '✓' },
  };

  const c = config[variant];

  return `
    <table role="presentation" style="width: 100%; border: none; border-spacing: 0; margin: ${spacing.md} 0;">
      <tr>
        <td style="padding: ${spacing.md}; background-color: ${c.bg}; border-radius: ${borderRadius.md}; border-left: 4px solid ${c.border};">
          <span style="font-family: ${fonts.primary}; font-size: 14px; line-height: 1.6; color: ${colors.gray[700]};">
            ${c.icon} ${text}
          </span>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Closing text
 */
export function closing(text: string = 'Qualquer dúvida, estamos à disposição!'): string {
  return `
    <p style="margin: ${spacing.lg} 0 0; font-family: ${fonts.primary}; font-size: 15px; line-height: 1.7; color: ${colors.gray[600]};">
      ${text}
    </p>
  `;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Format currency (BRL)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Format date
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format date with time
 */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
