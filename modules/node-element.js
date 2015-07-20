var _ 		= require('lodash');
var Node 	= require('./node');

function NodeElement(nodeName) {
	Node.call(this, nodeName);

	this.element = angular.element(`<li>
		<a>
			${nodeName}
		</a>
		<ul id="childrens"></ul>
	</li>`);
	this.node = _.first(this.element);
}

_.extend(NodeElement.prototype, Node.prototype, {
	addChild: function (node) {
		this.__parent__.addChild.apply(this, arguments);

		this.getNode().querySelector('#childrens').appendChild(node.getNode());
	},

	getPath: function () {
		lastParent = this.getParent() || this;

		var path = [];

		do {
			path.push(lastParent.getName());

			lastParent = lastParent.hasParent() && lastParent.getParent() || undefined;
		} while(lastParent);

		return path.reverse().join('/');
	},

	getNode: function () {
		var node = this.node;

		if(this.hasChild()) {
			node.setAttribute('node-has-children', '');
		} else {
			node.setAttribute('ng-click', `structureCtrl.readFile('${this.getPath()}')`);
		}

		return node;
	},

	getElement: function () {
		return angular.element(this.getNode());
	},

	__parent__: Node.prototype
});

module.exports = NodeElement;