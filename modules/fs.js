var Q  = require('q');
var fs = require('fs');

module.exports = {
	readdir: function (path) {
		var deferred = Q.defer();

		fs.readdir(path, function (err, files) {
			if(err) {
				deferred.reject(err);
			} else {
				deferred.resolve(files);
			}
		});

		return deferred.promise;
	},
	stat: function (path) {
		var deferred = Q.defer();

		fs.stat(path, function (err, stat) {
			if(err) {
				deferred.reject(err);
			} else {
				deferred.resolve(stat);
			}
		});

		return deferred.promise;
	},
	statSync: fs.statSync
};