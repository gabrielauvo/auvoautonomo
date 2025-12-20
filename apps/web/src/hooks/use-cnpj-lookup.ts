/**
 * useCnpjLookup Hook - Hook para consulta de CNPJ
 *
 * Fornece funcionalidade de consulta de dados de empresa via CNPJ
 */

import { useMutation } from '@tanstack/react-query';
import { cnpjService, CnpjLookupResponse } from '@/services/cnpj.service';

/**
 * Hook para consultar dados de empresa pelo CNPJ
 *
 * @example
 * const { mutate: lookupCnpj, data, isPending, error } = useCnpjLookup();
 *
 * // Ao digitar um CNPJ válido
 * lookupCnpj('33000167000101', {
 *   onSuccess: (data) => {
 *     setFormData(prev => ({
 *       ...prev,
 *       name: data.name,
 *       email: data.email || '',
 *       phone: data.phone || '',
 *       address: data.address || '',
 *       city: data.city || '',
 *       state: data.state || '',
 *       zipCode: data.zipCode || '',
 *     }));
 *   },
 * });
 */
export function useCnpjLookup() {
  return useMutation<CnpjLookupResponse, Error, string>({
    mutationFn: (cnpj: string) => cnpjService.lookupCnpj(cnpj),
  });
}

export default useCnpjLookup;
