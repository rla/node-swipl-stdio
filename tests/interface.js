const assert = require('assert');
const swipl = require('../');
const engine = new swipl.Engine();

describe('SWI-Prolog interface', () => {

    it('should run a simple query', async () => {
        const query = await engine.createQuery('member(X, [1,2,3,4])');
        try {
            const result = await query.next();
            assert.equal(result.X, 1);
        } finally {
            await query.close();
        }
    });

    it('should run a query with multiple solutions', async () => {
        const query = await engine.createQuery('member(X, [1,2,3,4])');
        try {
            const r1 = await query.next();
            assert.equal(r1.X, 1);
            const r2 = await query.next();
            assert.equal(r2.X, 2);
        } finally {
            await query.close();
        }
    });

    it('should allow to close a fresh query', async () => {
        const query = await engine.createQuery('member(X, [1,2,3,4])');
        await query.close();
    });

    it('should queue when opening multiple queries', async () => {
        const q1 = await engine.createQuery('member(X, [1,2,3,4])');
        await q1.next();
        const q2 = engine.createQuery('member(X, [1,2,3,4])');
        await q1.close();
        await (await q2).close();
    });

    it('should queue up multiple calls too', async () => {
        const c1 = engine.call('member(X, [1,2,3,4])');
        const c2 = engine.call('member(X, [a,b,c,d])');
        const results = await Promise.all([c1, c2]);
        assert.equal(results[0].X, 1);
        assert.equal(results[1].X, 'a');
    });

    it('should accept unicode atoms', async () => {
        const result = await engine.call("atom_length('♥', L)");
        assert.equal(result.L, 1);
    });

    it('should export a variable', async () => {
        const result = await engine.call('T=_');
        assert.equal(typeof result.T, 'object');
        assert.equal(typeof result.T.variable, 'string');
        assert.ok(result.T.variable.match(/^_\d+$/));
    });

    it('should export an atom', async () => {
        const result = await engine.call('T=a');
        assert.equal(result.T, 'a');
    });

    it('should export a string', async () => {
        const result = await engine.call('T="a"');
        assert.equal(result.T, 'a');
    });

    it('should export a number', async () => {
        const result = await engine.call('T=1');
        assert.equal(result.T, 1);
    });

    it('should export a compound', async () => {
        const result = await engine.call('T=f(a)');
        assert.equal(typeof result.T, 'object');
        assert.equal(result.T.name, 'f');
        assert.ok(Array.isArray(result.T.args));
        assert.equal(result.T.args.length, 1);
        assert.equal(result.T.args[0], 'a');
    });

    it('should export an empty list', async () => {
        const result = await engine.call('T=[]');
        assert.equal(result.T, '[]');
    });

    it('should export a list', async () => {
        const result = await engine.call('T=[1,2,3]');
        assert.equal(typeof result.T, 'object');
        assert.equal(result.T.head, 1);
        assert.equal(result.T.tail.head, 2);
        assert.equal(result.T.tail.tail.head, 3);
        assert.equal(result.T.tail.tail.tail, '[]');        
    });

    it('should export a dict with tag', async () => {
        const result = await engine.call('T=a{e:1}');
        assert.equal(result.T.tag, 'a');
        assert.equal(result.T.content.e, 1);
    });

    it('should export a dict without tag', async () => {
        const result = await engine.call('T=_{e:1}');
        assert.equal(result.T.content.e, 1);
        assert.equal(typeof result.T.tag.variable, 'string');
    });

    it('should output to stderr', async () => {
        await engine.call('writeln(hello)');
        await engine.call('writeln(user_error, hello)');
        await engine.call('writeln(user_output, hello)');
    });
});
