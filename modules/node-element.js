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
		lastParent = this;

		var path = [];

		do {
			path.push(lastParent.getName());

			lastParent = lastParent.hasParent() && lastParent.getParent() || undefined;
		} while(angular.isDefined(lastParent));

		return path.reverse().join('/');
	},

	setAsFile: function () {
		this.node.removeAttribute('node-has-children');
		this.node.setAttribute('node-is-file', '');
	},

	setAsFolder: function () {
		this.node.removeAttribute('node-is-file');
		this.node.setAttribute('node-has-children', '');
	},

	getNode: function () {
		var node = this.node;

		if(this.hasChild()) {
			this.setAsFolder();
		} else {
			this.setAsFile();

			var anchorEl = node.querySelector('li[node-is-file] > a');

			if(anchorEl) {
				anchorEl
				.setAttribute('ng-click', `structureCtrl.readFile('${this.getPath()}')`);
			}
		}

		return node;
	},

	getElement: function () {
		return angular.element(this.getNode());
	},

	__parent__: Node.prototype
});

module.exports = NodeElement;