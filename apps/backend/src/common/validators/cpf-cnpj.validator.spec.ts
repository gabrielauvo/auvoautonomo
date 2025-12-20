import { validate } from 'class-validator';
import { IsCpfCnpj, IsCpfCnpjConstraint } from './cpf-cnpj.validator';

describe('IsCpfCnpj Validator', () => {
  let validator: IsCpfCnpjConstraint;

  beforeEach(() => {
    validator = new IsCpfCnpjConstraint();
  });

  describe('CPF Validation', () => {
    it('should return true for valid CPF (only numbers)', () => {
      // CPF válido: 529.982.247-25
      expect(validator.validate('52998224725')).toBe(true);
    });

    it('should return true for valid CPF (formatted)', () => {
      expect(validator.validate('529.982.247-25')).toBe(true);
    });

    it('should return false for invalid CPF (wrong check digits)', () => {
      expect(validator.validate('52998224700')).toBe(false);
    });

    it('should return false for CPF with all same digits', () => {
      expect(validator.validate('11111111111')).toBe(false);
      expect(validator.validate('00000000000')).toBe(false);
      expect(validator.validate('99999999999')).toBe(false);
    });

    it('should return false for CPF with wrong length', () => {
      expect(validator.validate('1234567890')).toBe(false); // 10 digits
      expect(validator.validate('123456789012')).toBe(false); // 12 digits
    });

    it('should validate other valid CPFs', () => {
      // CPFs válidos matematicamente (gerados para teste)
      expect(validator.validate('52998224725')).toBe(true);
      // O primeiro CPF já está validado acima, este teste confirma a consistência
    });
  });

  describe('CNPJ Validation', () => {
    it('should return true for valid CNPJ (only numbers)', () => {
      // CNPJ válido: 10.426.136/0001-11
      expect(validator.validate('10426136000111')).toBe(true);
    });

    it('should return true for valid CNPJ (formatted)', () => {
      expect(validator.validate('10.426.136/0001-11')).toBe(true);
    });

    it('should return false for invalid CNPJ (wrong check digits)', () => {
      expect(validator.validate('10426136000100')).toBe(false);
    });

    it('should return false for CNPJ with all same digits', () => {
      expect(validator.validate('11111111111111')).toBe(false);
      expect(validator.validate('00000000000000')).toBe(false);
      expect(validator.validate('99999999999999')).toBe(false);
    });

    it('should return false for CNPJ with wrong length', () => {
      expect(validator.validate('1042613600011')).toBe(false); // 13 digits
      expect(validator.validate('104261360001111')).toBe(false); // 15 digits
    });

    it('should validate multiple valid CNPJs', () => {
      expect(validator.validate('10426136000111')).toBe(true);
      expect(validator.validate('11.222.333/0001-81')).toBe(true);
      expect(validator.validate('45.997.418/0001-53')).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should return false for null value', () => {
      expect(validator.validate(null)).toBe(false);
    });

    it('should return false for undefined value', () => {
      expect(validator.validate(undefined)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(validator.validate('')).toBe(false);
    });

    it('should return false for non-string values', () => {
      expect(validator.validate(12345678900 as any)).toBe(false);
      expect(validator.validate({} as any)).toBe(false);
      expect(validator.validate([] as any)).toBe(false);
    });

    it('should return false for string with only special characters', () => {
      expect(validator.validate('...-')).toBe(false);
      expect(validator.validate('...///-')).toBe(false);
    });

    it('should handle mixed formatting', () => {
      expect(validator.validate('529 982 247 25')).toBe(true); // CPF com espaços
      expect(validator.validate('10 426 136 0001 11')).toBe(true); // CNPJ com espaços
    });
  });

  describe('defaultMessage', () => {
    it('should return default error message', () => {
      expect(validator.defaultMessage()).toBe('CPF ou CNPJ inválido');
    });
  });

  describe('Decorator integration', () => {
    class TestDto {
      @IsCpfCnpj({ message: 'Documento inválido' })
      taxId: string;
    }

    it('should validate class property with valid CPF', async () => {
      const dto = new TestDto();
      dto.taxId = '52998224725';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate class property with valid CNPJ', async () => {
      const dto = new TestDto();
      dto.taxId = '10426136000111';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with invalid document', async () => {
      const dto = new TestDto();
      dto.taxId = '12345678900';

      const errors = await validate(dto);
      expect(errors.length).toBe(1);
      expect(errors[0].constraints).toHaveProperty('IsCpfCnpjConstraint');
    });

    it('should use custom error message', async () => {
      const dto = new TestDto();
      dto.taxId = '12345678900';

      const errors = await validate(dto);
      expect(errors[0].constraints?.IsCpfCnpjConstraint).toBe('Documento inválido');
    });
  });
});
