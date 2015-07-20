var _						= require('lodash');
var Q 					= require('q');
var fs 					= require('../modules/fs');
var map					= _.map;
var path 				= require('path');
var glob					= require('../modules/glob');
var Node 				= require('../modules/node-element');
var first				= _.first;
var filter				= _.filter;
var forEach			= _.forEach;
var flattenDeep	= _.flattenDeep;
var isUndefined	= _.isUndefined;

function DirectoryStructure(paths) {
	this.paths = paths;
	this.nodes = [];

	forEach(this.paths, function (segments) {
		segments = segments.split('/');

		var nodeName = first(segments);	
		var parentNode = this.getNode(nodeName) ||
											new Node(nodeName);

		this.addNode(this.createNodes(segments, parentNode, 1));
	}, this);
}
DirectoryStructure.getStructure = function () {
	return fs.readdir(process.cwd()).then(function (files) {
		return Q.all(map(filter(files, function (file) {
			return file !== 'node_modules';
		}), function (file) {
			return fs.stat(file).then(function (stat) {
				if(stat.isDirectory()) {
					return glob(path.resolve(file, '**/*.*'));
				} else {
					return file;
				}
			});
		}));
	}).then(function(paths) {
		paths = map(flattenDeep(paths), function (path) {
			return path.replace(`${process.cwd()}/`, '');
		});

		return new DirectoryStructure(paths);
	});
};
DirectoryStructure.prototype = {
	addNode: function (node) {
		if(this.getNode(node.name)) {
			return true;
		} else {
			this.nodes.push(node);
		}
	},
	getElements: function () {
		var container = angular.element('<ul>');

		forEach(this.nodes, function (node) {
			container.append(node.getElement());
		});

		return container;
	},
	getNode: function (name) {	
		return first(filter(this.nodes, function (node) {
			return node.compareName(name);
		}));
	},
	getNodes: function () {
		return this.nodes;
	},
	createNodes: function (segments, parentNode, depth) {
		forEach(segments.slice(depth, depth + 1), function (segment, index) {
			var childNode = parentNode.getChildByName(segment) || new Node(segment);

			// If the parent node doesn't have the actual
			// children node, add to his list 
			if(!parentNode.hasChild(childNode)) {
				parentNode.addChild(childNode);
			}

			// Now we load the next segments, notice that
			// now the parent node will be our childNode
			// and we will have one more depth level
			this.createNodes(segments, childNode, depth + 1);
		}, this);

		return parentNode;
	}
};

angular.module('textEditor')
.factory('DirectoryStructure', function () {
	return DirectoryStructure;
});