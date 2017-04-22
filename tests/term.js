const assert = require('assert');
const swipl = require('../');
const { list, compound, variable, serialize } = swipl.term;

describe('SWI-Prolog interface', () => {

    it('should escape a compound', () => { 
        const safe = serialize(
            compound('member', [
                variable('X'),
                list([1, 2, 3, 4])]));
        assert.equal(safe, "'member'(X,[1,2,3,4])");
    });
});
