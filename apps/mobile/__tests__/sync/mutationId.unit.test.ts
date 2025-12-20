/**
 * MutationId Generation Unit Tests
 *
 * Testes unitários para garantir que mutationIds são gerados corretamente
 * e evitam colisões no cache de idempotência do backend.
 *
 * Bug corrigido: DELETE mutations retornavam isActive:true porque
 * usavam o mesmo mutationId que CREATE anterior (cache collision).
 */

describe('MutationId Generation Logic', () => {
  /**
   * Função que replica a lógica de geração de mutationId do SyncEngine
   * Veja: apps/mobile/src/sync/SyncEngine.ts linha 657-661
   */
  function generateMutationId(
    entityId: string,
    operation: string,
    localMutationId: number
  ): string {
    return `${entityId}-${operation}-${localMutationId}`;
  }

  describe('mutationId format', () => {
    it('should generate mutationId with format: entityId-operation-localMutationId', () => {
      const mutationId = generateMutationId('client-uuid-123', 'create', 42);
      expect(mutationId).toBe('client-uuid-123-create-42');
    });

    it('should include operation type in mutationId', () => {
      const createId = generateMutationId('abc', 'create', 1);
      const updateId = generateMutationId('abc', 'update', 2);
      const deleteId = generateMutationId('abc', 'delete', 3);

      expect(createId).toContain('-create-');
      expect(updateId).toContain('-update-');
      expect(deleteId).toContain('-delete-');
    });

    it('should include local mutation id for uniqueness', () => {
      const id1 = generateMutationId('client', 'create', 100);
      const id2 = generateMutationId('client', 'create', 101);

      expect(id1).toBe('client-create-100');
      expect(id2).toBe('client-create-101');
      expect(id1).not.toBe(id2);
    });
  });

  describe('uniqueness guarantees', () => {
    it('should generate different mutationIds for CREATE, UPDATE, DELETE on same entity', () => {
      const entityId = 'client-uuid-456';

      const createId = generateMutationId(entityId, 'create', 1);
      const updateId = generateMutationId(entityId, 'update', 2);
      const deleteId = generateMutationId(entityId, 'delete', 3);

      // All should be unique
      const uniqueIds = new Set([createId, updateId, deleteId]);
      expect(uniqueIds.size).toBe(3);

      // Verify format
      expect(createId).toBe(`${entityId}-create-1`);
      expect(updateId).toBe(`${entityId}-update-2`);
      expect(deleteId).toBe(`${entityId}-delete-3`);
    });

    it('should NOT use just entityId as mutationId (old bug)', () => {
      const entityId = 'client-uuid-789';

      const createId = generateMutationId(entityId, 'create', 1);
      const deleteId = generateMutationId(entityId, 'delete', 2);

      // Critical: mutationId must NOT be just the entityId
      expect(createId).not.toBe(entityId);
      expect(deleteId).not.toBe(entityId);

      // They must be different from each other
      expect(createId).not.toBe(deleteId);
    });

    it('should prevent idempotency cache collision between CREATE and DELETE', () => {
      // Scenario that was causing the bug:
      // 1. CREATE sent with mutationId = "abc" (old format: just entityId)
      // 2. Backend caches result in processedMutation table
      // 3. DELETE sent with mutationId = "abc" (same entityId)
      // 4. Backend returns cached CREATE result with isActive:true
      //
      // With new format, this cannot happen:
      const entityId = 'abc';

      const createId = generateMutationId(entityId, 'create', 1);
      const deleteId = generateMutationId(entityId, 'delete', 2);

      // Different operations MUST have different mutationIds
      expect(createId).not.toBe(deleteId);

      // Verify the format prevents confusion
      expect(createId).toBe('abc-create-1');
      expect(deleteId).toBe('abc-delete-2');
    });
  });

  describe('result matching', () => {
    /**
     * Simula o mapeamento de resultados do backend para mutations locais
     * Veja: apps/mobile/src/sync/SyncEngine.ts linha 580-586
     */
    function matchResults(
      mutations: Array<{ id: number; entityId: string; operation: string }>,
      serverResults: Array<{ mutationId: string; status: string }>
    ): Map<number, string> {
      const resultsMap = new Map<string, { mutationId: string; status: string }>();
      for (const result of serverResults) {
        if (result?.mutationId) {
          resultsMap.set(result.mutationId, result);
        }
      }

      const matchedResults = new Map<number, string>();
      for (const mutation of mutations) {
        const expectedMutationId = generateMutationId(
          mutation.entityId,
          mutation.operation,
          mutation.id
        );
        const result = resultsMap.get(expectedMutationId);
        if (result) {
          matchedResults.set(mutation.id, result.status);
        }
      }

      return matchedResults;
    }

    it('should match results by exact mutationId including operation', () => {
      const mutations = [
        { id: 10, entityId: 'client-a', operation: 'update' },
      ];
      const serverResults = [
        { mutationId: 'client-a-update-10', status: 'applied' },
      ];

      const matches = matchResults(mutations, serverResults);
      expect(matches.get(10)).toBe('applied');
    });

    it('should NOT match if result uses old format (just entityId)', () => {
      const mutations = [
        { id: 20, entityId: 'client-b', operation: 'create' },
      ];
      // Old format - should NOT match
      const serverResults = [
        { mutationId: 'client-b', status: 'applied' },
      ];

      const matches = matchResults(mutations, serverResults);
      expect(matches.get(20)).toBeUndefined(); // No match!
    });

    it('should correctly match batch of mutations', () => {
      const mutations = [
        { id: 100, entityId: 'client-a', operation: 'create' },
        { id: 101, entityId: 'client-b', operation: 'update' },
        { id: 102, entityId: 'client-c', operation: 'delete' },
      ];
      const serverResults = [
        { mutationId: 'client-a-create-100', status: 'applied' },
        { mutationId: 'client-b-update-101', status: 'applied' },
        { mutationId: 'client-c-delete-102', status: 'applied' },
      ];

      const matches = matchResults(mutations, serverResults);
      expect(matches.get(100)).toBe('applied');
      expect(matches.get(101)).toBe('applied');
      expect(matches.get(102)).toBe('applied');
      expect(matches.size).toBe(3);
    });

    it('should handle partial matches (some rejected)', () => {
      const mutations = [
        { id: 200, entityId: 'success', operation: 'create' },
        { id: 201, entityId: 'fail', operation: 'create' },
      ];
      const serverResults = [
        { mutationId: 'success-create-200', status: 'applied' },
        { mutationId: 'fail-create-201', status: 'rejected' },
      ];

      const matches = matchResults(mutations, serverResults);
      expect(matches.get(200)).toBe('applied');
      expect(matches.get(201)).toBe('rejected');
    });
  });
});
