/*  Copyright (c) 2014, Torbjörn Lager
    All rights reserved.
    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions
    are met:
    1. Redistributions of source code must retain the above copyright
    notice, this list of conditions and the following disclaimer.
    2. Redistributions in binary form must reproduce the above copyright
    notice, this list of conditions and the following disclaimer in the
    documentation and/or other materials provided with the distribution.
    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
    "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
    LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
    FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
    COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
    INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
    BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
    LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
    CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
    LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
    ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
    POSSIBILITY OF SUCH DAMAGE.
*/

const assert = require('assert');

const dec2unicode = (i) => {
    let r;
    if (i >= 0 && i <= 15) {
        return "\\u000" + i.toString(16);
    } else if (i >= 16 && i <= 255) {
        return "\\u00" + i.toString(16);
    } else if (i >= 256  && i <= 4095) {
        return "\\u0" + i.toString(16);
    } else if (i >= 4096 && i <= 65535) {
        return "\\u" + i.toString(16);
    }
}

module.exports = (s, q) => {
    assert.equal(typeof s, 'string');
    assert.equal(typeof q, 'string');
    let result = q;
    for (let i = 0; i < s.length; i++) {
        let c = s.charAt(i);
        if (c >= ' ') {
            if (c == '\\') {
                result += "\\\\";
            } else if (c == q) {
                result += "\\" + q;
            } else {
                result += c
            };
        } else {
            if (c == '\n') {
                result += "\\n";
            } else if (c == '\r') {
                result += "\\r";
            } else if (c == '\t') {
                result += "\\t";
            } else if (c == '\b') {
                result += "\\b";
            } else if (c == '\f') {
                result += "\\f";
            } else {
                result += dec2unicode(c.charCodeAt(0));
            }
        }
    }
    return result + q;
};
