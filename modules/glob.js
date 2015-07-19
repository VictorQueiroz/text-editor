var Q		 = require('q');
var glob = require('glob');

module.exports = function (path) {
	var deferred = Q.defer();

	glob(path, function (err, files) {
		if(err) {
			deferred.reject(err);
		} else {
			deferred.resolve(files);
		}
	});

	return deferred.promise;
};

module.exports.sync = glob.sync;