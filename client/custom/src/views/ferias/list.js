define('custom:views/ferias/list', ['views/list'], function (Dep) {

    return Dep.extend({

        cssId: 'ferias-wow-style',

        css: [
            /* Hide timeline column on tablets and below — it can't render usefully in narrow space */
            '@media screen and (max-width: 900px) {',
            '  .ferias-responsive .list table th[data-name="timeline"],',
            '  .ferias-responsive .list table td[data-name="timeline"] { display: none !important; }',
            '}',
            /* Hide seccao on small phones */
            '@media screen and (max-width: 500px) {',
            '  .ferias-responsive .list table th[data-name="seccao"],',
            '  .ferias-responsive .list table td[data-name="seccao"],',
            '  .ferias-responsive .list table th[data-name="colaborador"],',
            '  .ferias-responsive .list table td[data-name="colaborador"] { display: none !important; }',
            '  .ferias-responsive .list table { font-size: 12px; }',
            '}'
        ].join('\n'),

        injectCss: function () {
            if (document.getElementById(this.cssId)) {
                return;
            }

            var style = document.createElement('style');
            style.id = this.cssId;
            style.type = 'text/css';
            style.appendChild(document.createTextNode(this.css));
            document.head.appendChild(style);
        },

        afterRender: function () {
            Dep.prototype.afterRender.call(this);

            this.injectCss();
            this.$el.addClass('ferias-responsive');

            this.injectQuemFeriasButton();
        },

        injectQuemFeriasButton: function () {
            if (this.$el.find('.ferias-quem-btn').length) {
                return;
            }

            var self = this;
            var $btn = $('<button class="btn btn-default ferias-quem-btn" type="button" ' +
                'title="Ver quem está ou vai estar de férias" ' +
                'style="margin-left:6px;white-space:nowrap;">' +
                '<span class="fas fa-umbrella-beach" style="margin-right:5px;"></span>' +
                'Férias' +
                '</button>');

            $btn.on('click', function () {
                self.openQuemFerias();
            });

            // Find the Create button area and insert after it
            var $createBtn = this.$el.find('.btn[data-action="quickCreate"], button[data-action="create"], a[data-action="create"]').first();

            if ($createBtn.length) {
                $createBtn.after($btn);
            } else {
                // Fallback: add to the page-header or search bar area
                var $toolbar = this.$el.find('.list-buttons-container, .page-header .btn-group, .header-buttons').first();
                if ($toolbar.length) {
                    $toolbar.append($btn);
                } else {
                    this.$el.find('.search-container, .above-collection').first().after(
                        $('<div style="margin-bottom:8px;"></div>').append($btn)
                    );
                }
            }
        },

        openQuemFerias: function () {
            this.createView('quemFeriasModal', 'custom:views/ferias/modals/quem-ferias', {}, function (view) {
                view.render();
            });
        }
    });
});
