const dotenv = require('dotenv').config();

if (dotenv.error) {
    throw dotenv.error;
}

const expect = require('chai').expect;
const ThreadId = require('../../Thread_ID.model');
 
describe('ThreadId Model: ', function() {
    it('should be invalid if new ThreadId() is empty', function(done) {
        var threadId = new ThreadId();
 
        threadId.validate(function(err) {
            expect(err.errors).to.exist;
            done();
        });
    });

    it('should be invalid if new ThreadId() is missing userId', function(done) {
        var threadId = new ThreadId({
            threadId: 'threadId'
        });
 
        threadId.validate(function(err) {
            expect(err.errors).to.exist;
            done();
        });
    });

    it('should be invalid if new ThreadId() is missing threadId', function(done) {
        var threadId = new ThreadId({
            userId: 'userId'
        });
 
        threadId.validate(function(err) {
            expect(err.errors).to.exist;
            done();
        });
    });

    it('should be valid if new ThreadId() has userId and threadId', function(done) {
        var threadId = new ThreadId({
            userId: 'userId',
            threadId: 'threadId'
        });
 
        threadId.validate(function(err) {
            expect(err).not.to.exist;
            done();
        });
    });
});