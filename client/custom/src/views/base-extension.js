define('custom:views/base-extension', ['views/base'], function (Dep) {

    return Dep.extend({

        afterRender: function () {
            Dep.prototype.afterRender.call(this);

            this.injectGlobalResponsiveCss();
        },

        injectGlobalResponsiveCss: function () {
            if (document.getElementById('custom-global-responsive-css')) {
                return;
            }

            var css = '@media screen and (max-width: 700px) {' +
                'body { font-size: 13px; }' +
                '.list table { font-size: 12px; }' +
                '.list table thead { display: none; }' +
                '.list table tbody tr { display: block; margin: 8px 0; border: 1px solid #333; padding: 8px; border-radius: 4px; }' +
                '.list table tbody tr td { display: block; text-align: left; padding: 6px 0; border: none; }' +
                '.list table tbody tr td:before { font-weight: 600; content: attr(data-label); display: block; color: #999; font-size: 11px; margin-bottom: 2px; }' +
                '}';

            var style = document.createElement('style');
            style.id = 'custom-global-responsive-css';
            style.appendChild(document.createTextNode(css));
            document.head.appendChild(style);
        }
    });
});
