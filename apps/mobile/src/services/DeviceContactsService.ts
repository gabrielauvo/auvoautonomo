/**
 * Device Contacts Service
 *
 * Serviço para criar contatos na agenda do dispositivo quando clientes são criados.
 *
 * Características:
 * - Solicita permissão apenas quando necessário
 * - Falha silenciosa (nunca impede criação do cliente)
 * - Verifica duplicatas antes de criar
 * - Respeita privacidade (dados mínimos: nome + telefone)
 * - Offline-first: agenda é local, não depende de sync
 *
 * @module DeviceContactsService
 */

import * as Contacts from 'expo-contacts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../observability/Logger';
import { SYNC_FLAGS } from '../config/syncFlags';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateContactInput {
  name: string;
  phone: string;
  companyName?: string;
}

export interface ContactCreationResult {
  success: boolean;
  contactId?: string;
  error?: string;
  skipped?: boolean;
  skipReason?: 'no_permission' | 'duplicate' | 'feature_disabled' | 'empty_phone';
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STORAGE_KEYS = {
  /** Flag indicando que o usuário habilitou a feature de criar contatos */
  CONTACT_SYNC_ENABLED: '@auvo:contact_sync_enabled',
  /** Flag indicando que já pedimos permissão uma vez (evita spam) */
  PERMISSION_ASKED: '@auvo:contacts_permission_asked',
};

const APP_NOTE = 'Criado pelo Auvo Autônomos';
const LOG_CATEGORY = 'device_contacts';

// =============================================================================
// PHONE NORMALIZATION
// =============================================================================

/**
 * Normaliza número de telefone para comparação
 *
 * Remove espaços, parênteses, hífens, pontos
 * Mantém apenas dígitos e o sinal +
 *
 * @example
 * normalizePhone('(11) 99999-9999') // '11999999999'
 * normalizePhone('+55 11 99999-9999') // '+5511999999999'
 * normalizePhone('11.99999.9999') // '11999999999'
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';

  // Remove tudo exceto dígitos e +
  let normalized = phone.replace(/[^\d+]/g, '');

  // Se começar com 00 (código internacional alternativo), converter para +
  if (normalized.startsWith('00')) {
    normalized = '+' + normalized.slice(2);
  }

  return normalized;
}

/**
 * Verifica se dois nomes são similares (para evitar duplicatas)
 *
 * Compara nomes ignorando case e acentos
 * Considera match se um nome contém o outro ou se são iguais
 *
 * @example
 * areNamesSimilar('João Silva', 'João silva') // true
 * areNamesSimilar('João Silva', 'João') // true (substring)
 * areNamesSimilar('Maria', 'João') // false
 */
export function areNamesSimilar(name1: string, name2: string): boolean {
  if (!name1 || !name2) return false;

  // Normaliza removendo acentos e convertendo para minúsculas
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const n1 = normalize(name1);
  const n2 = normalize(name2);

  // Match exato ou substring
  return n1 === n2 || n1.includes(n2) || n2.includes(n1);
}

// =============================================================================
// DEVICE CONTACTS SERVICE
// =============================================================================

class DeviceContactsServiceClass {
  // ==========================================================================
  // PERMISSION MANAGEMENT
  // ==========================================================================

  /**
   * Verifica se temos permissão para acessar contatos
   */
  async hasPermission(): Promise<boolean> {
    try {
      const { status } = await Contacts.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      logger.error('Failed to check contacts permission', error, {
        category: LOG_CATEGORY,
      });
      return false;
    }
  }

  /**
   * Solicita permissão para acessar contatos
   *
   * Só solicita se ainda não foi negada antes (evita spam)
   * Armazena flag para não pedir repetidamente
   */
  async requestPermission(): Promise<boolean> {
    try {
      // Verifica se já temos permissão
      const hasPermission = await this.hasPermission();
      if (hasPermission) return true;

      // Verifica se já pedimos antes e foi negado
      const alreadyAsked = await AsyncStorage.getItem(
        STORAGE_KEYS.PERMISSION_ASKED
      );
      if (alreadyAsked === 'denied') {
        logger.debug('Contacts permission already denied, not asking again', {
          category: LOG_CATEGORY,
        });
        return false;
      }

      // Solicita permissão
      const { status } = await Contacts.requestPermissionsAsync();
      const granted = status === 'granted';

      // Armazena resultado para não pedir novamente se negado
      await AsyncStorage.setItem(
        STORAGE_KEYS.PERMISSION_ASKED,
        granted ? 'granted' : 'denied'
      );

      logger.info('Contacts permission requested', {
        category: LOG_CATEGORY,
        granted,
      });

      return granted;
    } catch (error) {
      logger.error('Failed to request contacts permission', error, {
        category: LOG_CATEGORY,
      });
      return false;
    }
  }

  /**
   * Reseta o flag de permissão (permite pedir novamente)
   * Útil quando o usuário habilita manualmente nas configurações
   */
  async resetPermissionFlag(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.PERMISSION_ASKED);
      logger.debug('Contacts permission flag reset', {
        category: LOG_CATEGORY,
      });
    } catch (error) {
      logger.error('Failed to reset permission flag', error, {
        category: LOG_CATEGORY,
      });
    }
  }

  // ==========================================================================
  // FEATURE TOGGLE (User Preference)
  // ==========================================================================

  /**
   * Verifica se a feature está habilitada pelo usuário
   *
   * A feature flag global (SYNC_FLAGS.CREATE_CONTACT_ON_CLIENT_CREATE) controla
   * se a feature está disponível.
   *
   * Esta preferência local controla se o usuário optou por usar a feature.
   */
  async isFeatureEnabled(): Promise<boolean> {
    try {
      // Primeiro verifica a feature flag global
      if (!SYNC_FLAGS.CREATE_CONTACT_ON_CLIENT_CREATE) {
        return false;
      }

      // Depois verifica a preferência do usuário
      const enabled = await AsyncStorage.getItem(
        STORAGE_KEYS.CONTACT_SYNC_ENABLED
      );
      return enabled === 'true';
    } catch (error) {
      logger.error('Failed to check contact sync setting', error, {
        category: LOG_CATEGORY,
      });
      return false;
    }
  }

  /**
   * Habilita ou desabilita a feature
   */
  async setFeatureEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.CONTACT_SYNC_ENABLED,
        enabled ? 'true' : 'false'
      );

      // Se habilitando, reseta o flag de permissão para poder pedir
      if (enabled) {
        await this.resetPermissionFlag();
      }

      logger.info('Contact sync setting changed', {
        category: LOG_CATEGORY,
        enabled,
      });
    } catch (error) {
      logger.error('Failed to set contact sync setting', error, {
        category: LOG_CATEGORY,
      });
    }
  }

  // ==========================================================================
  // DUPLICATE DETECTION
  // ==========================================================================

  /**
   * Verifica se já existe um contato com o mesmo telefone
   *
   * Busca contatos com telefone similar (normalizado) e nome parecido
   */
  async contactExists(
    phone: string,
    name: string
  ): Promise<{ exists: boolean; contactId?: string }> {
    try {
      const hasPermission = await this.hasPermission();
      if (!hasPermission) {
        return { exists: false };
      }

      const normalizedPhone = normalizePhone(phone);
      if (!normalizedPhone) {
        return { exists: false };
      }

      // Busca contatos com o mesmo telefone
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
      });

      for (const contact of data) {
        const phones = contact.phoneNumbers || [];
        for (const phoneEntry of phones) {
          const contactPhone = normalizePhone(phoneEntry.number || '');
          if (contactPhone === normalizedPhone) {
            // Telefone igual - verifica nome também (opcional, para ser mais seguro)
            const contactName = contact.name || '';
            if (areNamesSimilar(contactName, name)) {
              return { exists: true, contactId: contact.id };
            }
            // Telefone igual mas nome diferente - consideramos duplicata pelo telefone
            return { exists: true, contactId: contact.id };
          }
        }
      }

      return { exists: false };
    } catch (error) {
      logger.error('Failed to check for duplicate contact', error, {
        category: LOG_CATEGORY,
        phone: phone.substring(0, 4) + '****', // Log parcial por privacidade
      });
      // Em caso de erro, assume que não existe (melhor criar duplicata do que não criar)
      return { exists: false };
    }
  }

  // ==========================================================================
  // CONTACT CREATION
  // ==========================================================================

  /**
   * Cria um contato na agenda do dispositivo
   *
   * @param input Dados do contato
   * @returns Resultado da operação
   */
  async createContact(input: CreateContactInput): Promise<ContactCreationResult> {
    const startTime = Date.now();

    try {
      // 1. Verifica se a feature está habilitada
      const featureEnabled = await this.isFeatureEnabled();
      if (!featureEnabled) {
        logger.debug('Contact creation skipped - feature disabled', {
          category: LOG_CATEGORY,
        });
        return {
          success: false,
          skipped: true,
          skipReason: 'feature_disabled',
        };
      }

      // 2. Verifica se o telefone está preenchido
      const normalizedPhone = normalizePhone(input.phone);
      if (!normalizedPhone) {
        logger.debug('Contact creation skipped - empty phone', {
          category: LOG_CATEGORY,
        });
        return {
          success: false,
          skipped: true,
          skipReason: 'empty_phone',
        };
      }

      // 3. Solicita permissão (se necessário)
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        logger.info('Contact creation skipped - no permission', {
          category: LOG_CATEGORY,
        });
        return {
          success: false,
          skipped: true,
          skipReason: 'no_permission',
        };
      }

      // 4. Verifica duplicatas
      const { exists, contactId: existingId } = await this.contactExists(
        normalizedPhone,
        input.name
      );
      if (exists) {
        logger.info('Contact creation skipped - duplicate found', {
          category: LOG_CATEGORY,
          existingContactId: existingId,
        });
        return {
          success: false,
          skipped: true,
          skipReason: 'duplicate',
          contactId: existingId,
        };
      }

      // 5. Monta o contato
      const contact: Contacts.Contact = {
        contactType: Contacts.ContactTypes.Person,
        name: input.name,
        firstName: input.name.split(' ')[0],
        lastName: input.name.split(' ').slice(1).join(' ') || undefined,
        phoneNumbers: [
          {
            number: input.phone, // Mantém formato original
            label: 'mobile',
          },
        ],
      };

      // Adiciona empresa se configurado
      if (SYNC_FLAGS.CONTACT_ADD_COMPANY_NAME && input.companyName) {
        contact.company = input.companyName;
      }

      // Adiciona nota se configurado
      if (SYNC_FLAGS.CONTACT_ADD_APP_NOTE) {
        contact.note = APP_NOTE;
      }

      // 6. Cria o contato
      const contactId = await Contacts.addContactAsync(contact);

      const duration = Date.now() - startTime;
      logger.info('Contact created successfully', {
        category: LOG_CATEGORY,
        contactId,
        duration,
      });

      return {
        success: true,
        contactId,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to create contact', error, {
        category: LOG_CATEGORY,
        duration,
        name: input.name,
        phone: input.phone.substring(0, 4) + '****',
      });

      // Falha silenciosa - retorna erro mas não propaga exceção
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Tenta criar contato após criação de cliente (best effort)
   *
   * Este método é o ponto de integração com o ClientService.
   * Nunca falha - apenas loga erros e segue.
   *
   * @param client Dados do cliente criado
   * @param companyName Nome da empresa do usuário (opcional)
   */
  async onClientCreated(
    client: { name: string; phone?: string | null },
    companyName?: string
  ): Promise<void> {
    // Verifica se tem telefone
    if (!client.phone) {
      return;
    }

    // Cria contato em background (não bloqueia)
    this.createContact({
      name: client.name,
      phone: client.phone,
      companyName,
    }).catch((error) => {
      // Catch adicional por segurança (createContact já não deveria propagar)
      logger.error('Unexpected error in onClientCreated', error, {
        category: LOG_CATEGORY,
      });
    });
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const DeviceContactsService = new DeviceContactsServiceClass();

export default DeviceContactsService;
