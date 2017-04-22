const assert = require('assert');
const swipl = require('../');
const { list, compound, variable, dict, serialize } = swipl.term;

describe('SWI-Prolog interface', () => {

    it('should escape a compound', () => { 
        const safe = serialize(
            compound('member', [
                variable('X'),
                list([1, 2, 3, 4])]));
        assert.equal(safe, "'member'(X,[1,2,3,4])");
    });

    it('should escape a dict', () => { 
        const safe = serialize(dict('test', {
            entry1: 1,
            entry2: compound('f', [2])
        }));
        assert.equal(safe, "'test'{'entry1':1,'entry2':'f'(2)}");
    });
});
