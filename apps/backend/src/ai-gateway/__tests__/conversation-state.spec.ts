import {
  ConversationState,
  isValidTransition,
  isConfirmation,
  isRejection,
  isModificationRequest,
  getDefaultStateData,
} from '../state-machine/conversation-state';

describe('ConversationState', () => {
  describe('isValidTransition', () => {
    it('should allow IDLE -> PLANNING', () => {
      expect(isValidTransition(ConversationState.IDLE, ConversationState.PLANNING)).toBe(true);
    });

    it('should allow IDLE -> EXECUTING (for read operations)', () => {
      expect(isValidTransition(ConversationState.IDLE, ConversationState.EXECUTING)).toBe(true);
    });

    it('should allow PLANNING -> AWAITING_CONFIRMATION', () => {
      expect(isValidTransition(ConversationState.PLANNING, ConversationState.AWAITING_CONFIRMATION)).toBe(true);
    });

    it('should allow PLANNING -> PLANNING (collecting more fields)', () => {
      expect(isValidTransition(ConversationState.PLANNING, ConversationState.PLANNING)).toBe(true);
    });

    it('should allow PLANNING -> IDLE (user cancels)', () => {
      expect(isValidTransition(ConversationState.PLANNING, ConversationState.IDLE)).toBe(true);
    });

    it('should allow AWAITING_CONFIRMATION -> EXECUTING', () => {
      expect(isValidTransition(ConversationState.AWAITING_CONFIRMATION, ConversationState.EXECUTING)).toBe(true);
    });

    it('should allow AWAITING_CONFIRMATION -> IDLE (user rejects)', () => {
      expect(isValidTransition(ConversationState.AWAITING_CONFIRMATION, ConversationState.IDLE)).toBe(true);
    });

    it('should allow AWAITING_CONFIRMATION -> PLANNING (user wants to modify)', () => {
      expect(isValidTransition(ConversationState.AWAITING_CONFIRMATION, ConversationState.PLANNING)).toBe(true);
    });

    it('should allow EXECUTING -> IDLE', () => {
      expect(isValidTransition(ConversationState.EXECUTING, ConversationState.IDLE)).toBe(true);
    });

    it('should allow EXECUTING -> PLANNING (chain to next action)', () => {
      expect(isValidTransition(ConversationState.EXECUTING, ConversationState.PLANNING)).toBe(true);
    });

    it('should not allow IDLE -> AWAITING_CONFIRMATION directly', () => {
      expect(isValidTransition(ConversationState.IDLE, ConversationState.AWAITING_CONFIRMATION)).toBe(false);
    });

    it('should not allow EXECUTING -> AWAITING_CONFIRMATION', () => {
      expect(isValidTransition(ConversationState.EXECUTING, ConversationState.AWAITING_CONFIRMATION)).toBe(false);
    });
  });

  describe('isConfirmation', () => {
    it('should recognize "sim" as confirmation', () => {
      expect(isConfirmation('sim')).toBe(true);
      expect(isConfirmation('Sim')).toBe(true);
      expect(isConfirmation('SIM')).toBe(true);
    });

    it('should recognize "confirmo" as confirmation', () => {
      expect(isConfirmation('confirmo')).toBe(true);
      expect(isConfirmation('Confirmo')).toBe(true);
    });

    it('should recognize "sim, confirmo" as confirmation', () => {
      expect(isConfirmation('sim, confirmo')).toBe(true);
      expect(isConfirmation('sim confirmo')).toBe(true);
    });

    it('should recognize "ok" as confirmation', () => {
      expect(isConfirmation('ok')).toBe(true);
      expect(isConfirmation('OK')).toBe(true);
    });

    it('should recognize "pode" as confirmation', () => {
      expect(isConfirmation('pode')).toBe(true);
      expect(isConfirmation('pode fazer')).toBe(true);
      expect(isConfirmation('pode criar')).toBe(true);
    });

    it('should recognize "yes" and "confirm" as confirmation', () => {
      expect(isConfirmation('yes')).toBe(true);
      expect(isConfirmation('confirm')).toBe(true);
    });

    it('should recognize "confirmar" as confirmation', () => {
      expect(isConfirmation('confirmar')).toBe(true);
    });

    it('should recognize "prosseguir" and "executar" as confirmation', () => {
      expect(isConfirmation('prosseguir')).toBe(true);
      expect(isConfirmation('executar')).toBe(true);
    });

    it('should trim whitespace', () => {
      expect(isConfirmation('  sim  ')).toBe(true);
    });

    it('should not recognize other text as confirmation', () => {
      expect(isConfirmation('talvez')).toBe(false);
      expect(isConfirmation('não sei')).toBe(false);
      expect(isConfirmation('criar cliente')).toBe(false);
    });
  });

  describe('isRejection', () => {
    it('should recognize "não" as rejection', () => {
      expect(isRejection('não')).toBe(true);
      expect(isRejection('Não')).toBe(true);
      expect(isRejection('NÃO')).toBe(true);
    });

    it('should recognize "nao" (without accent) as rejection', () => {
      expect(isRejection('nao')).toBe(true);
    });

    it('should recognize "cancelar" as rejection', () => {
      expect(isRejection('cancelar')).toBe(true);
      expect(isRejection('cancela')).toBe(true);
    });

    it('should recognize "parar" as rejection', () => {
      expect(isRejection('parar')).toBe(true);
      expect(isRejection('para')).toBe(true);
    });

    it('should recognize "desistir" as rejection', () => {
      expect(isRejection('desistir')).toBe(true);
    });

    it('should recognize "no" and "cancel" as rejection', () => {
      expect(isRejection('no')).toBe(true);
      expect(isRejection('cancel')).toBe(true);
    });

    it('should recognize "rejeitar" and "recusar" as rejection', () => {
      expect(isRejection('rejeitar')).toBe(true);
      expect(isRejection('rejeito')).toBe(true);
      expect(isRejection('recusar')).toBe(true);
      expect(isRejection('recuso')).toBe(true);
    });

    it('should trim whitespace', () => {
      expect(isRejection('  não  ')).toBe(true);
    });

    it('should not recognize other text as rejection', () => {
      expect(isRejection('sim')).toBe(false);
      expect(isRejection('ok')).toBe(false);
      expect(isRejection('criar cliente')).toBe(false);
    });
  });

  describe('isModificationRequest', () => {
    it('should recognize "alterar" as modification', () => {
      expect(isModificationRequest('quero alterar o nome')).toBe(true);
    });

    it('should recognize "modificar" as modification', () => {
      expect(isModificationRequest('vou modificar')).toBe(true);
    });

    it('should recognize "mudar" as modification', () => {
      expect(isModificationRequest('preciso mudar o email')).toBe(true);
    });

    it('should recognize "corrigir" as modification', () => {
      expect(isModificationRequest('deixa eu corrigir')).toBe(true);
    });

    it('should recognize "ajustar" as modification', () => {
      expect(isModificationRequest('preciso ajustar o valor')).toBe(true);
    });

    it('should recognize "editar" as modification', () => {
      expect(isModificationRequest('quero editar')).toBe(true);
    });

    it('should not recognize confirmation as modification', () => {
      expect(isModificationRequest('sim')).toBe(false);
      expect(isModificationRequest('confirmo')).toBe(false);
    });

    it('should not recognize rejection as modification', () => {
      expect(isModificationRequest('não')).toBe(false);
      expect(isModificationRequest('cancelar')).toBe(false);
    });
  });

  describe('getDefaultStateData', () => {
    it('should return IDLE state', () => {
      const data = getDefaultStateData();
      expect(data.state).toBe(ConversationState.IDLE);
    });

    it('should not have pending plan', () => {
      const data = getDefaultStateData();
      expect(data.pendingPlan).toBeUndefined();
    });
  });
});
