var Q  = require('q');
var fs = require('fs');

module.exports = {
	writeFile: function (filename, data) {
		var deferred = Q.defer();
		fs.writeFile(filename, data, function (err) {
			if(err) {
				return deferred.reject(err);
			}

			deferred.resolve();
		});
		return deferred.promise;
	},
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
	readFileSync: fs.readFileSync,
	readFile: function (path) {
		var deferred = Q.defer();

		fs.readFile(path, function (err, data) {
			if(err) {
				return deferred.reject(err);
			}

			deferred.resolve(data);
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