var _						= require('lodash');
var map					= _.map;
var first				= _.first;
var filter				= _.filter;
var forEach			= _.forEach;
var isUndefined	= _.isUndefined;

function createFile(filePath) {
	return {
		path: filePath,
		name: first(/([A-z]+(\s)?\.[A-z]+)$/.exec(path))
	};
}

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
DirectoryStructure.prototype = {
	addNode: function (node) {
		if(this.getNode(node.name)) {
			return true;
		} else {
			this.nodes.push(node);
		}
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