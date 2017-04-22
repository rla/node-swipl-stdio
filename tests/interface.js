const assert = require('assert');
const swipl = require('../');
const engine = new swipl.Engine();

describe('SWI-Prolog interface', () => {

    it('should run a simple query', async () => {
        const query = engine.createQuery('member(X, [1,2,3,4])');
        try {
            const result = await query.next();
            assert.equal(result.X, 1);
        } finally {
            query.close();
        }
    });

    it('should run a query with multiple solutions', async () => {
        const query = engine.createQuery('member(X, [1,2,3,4])');
        try {
            const r1 = await query.next();
            assert.equal(r1.X, 1);
            const r2 = await query.next();
            assert.equal(r2.X, 2);
        } finally {
            query.close();
        }
    });

    it('should allow to close a fresh query', async () => {
        const query = engine.createQuery('member(X, [1,2,3,4])');
        query.close();
    });

    it('should throw when opening multiple queries', async () => {
        const q1 = engine.createQuery('member(X, [1,2,3,4])');
        try {
            engine.createQuery('member(X, [1,2,3,4])');
        } catch (err) {
            assert.ok(err.toString().indexOf('AssertionError: Engine is ready for new queries') >= 0);
        } finally {
            q1.close();
        }
    });

    it('should accept unicode atoms', async () => {
        const query = engine.createQuery("atom_length('♥', L)");
        try {
            const result = await query.next();
            assert.equal(result.L, 1);
        } finally {
            query.close();
        }
    });
});
