define('custom:views/periodo-ferias/list', ['views/list'], function (Dep) {

    return Dep.extend({

        cssId: 'pf-wow-style',

        css: [
            '.pf-wow .list table { border-collapse: separate !important; border-spacing: 0 7px !important; }',
            '.pf-wow .list table > thead > tr > th {',
            '  border: none !important; text-transform: uppercase; font-size: 11px;',
            '  letter-spacing: .4px; color: #9aa0a6; padding-bottom: 4px;',
            '}',
            '.pf-wow .list table > tbody > tr.list-row {',
            '  background: rgba(255,255,255,0.03) !important;',
            '  transition: background .15s ease, box-shadow .15s ease, transform .15s ease;',
            '}',
            '.pf-wow .list table > tbody > tr.list-row:hover {',
            '  background: rgba(255,255,255,0.08) !important;',
            '  transform: translateY(-1px);',
            '  box-shadow: 0 4px 14px rgba(0,0,0,0.30);',
            '}',
            '.pf-wow .list table > tbody > tr.list-row > td {',
            '  border-top: 1px solid rgba(255,255,255,0.07);',
            '  border-bottom: 1px solid rgba(255,255,255,0.07);',
            '  padding-top: 13px !important; padding-bottom: 13px !important;',
            '  vertical-align: middle;',
            '}',
            '.pf-wow .list table > tbody > tr.list-row > td:first-child {',
            '  border-left: 4px solid #6c7a89;',
            '  border-top-left-radius: 9px; border-bottom-left-radius: 9px;',
            '}',
            '.pf-wow .list table > tbody > tr.list-row > td:last-child {',
            '  border-top-right-radius: 9px; border-bottom-right-radius: 9px;',
            '}',
            '.pf-wow .list .label {',
            '  padding: 4px 11px !important; border-radius: 12px !important;',
            '  font-size: 11px !important; font-weight: 600;',
            '}',
            '@media screen and (max-width: 768px) {',
            '  .pf-wow table thead { display: none !important; }',
            '  .pf-wow table tbody tr.list-row { display: block !important; margin: 10px 0 !important; }',
            '  .pf-wow table tbody tr.list-row td { display: block !important; border: none !important; padding: 8px 0 !important; text-align: right !important; position: relative !important; padding-left: 50% !important; }',
            '  .pf-wow table tbody tr.list-row td:before { content: attr(data-label) !important; position: absolute !important; left: 0 !important; font-weight: 600 !important; text-align: left !important; }',
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

        statusColor: function (model) {
            var c = model.get('aprovacaoChefia');
            var d = model.get('aprovadirecao');

            if (c === 'Recusado' || d === 'Recusado') {
                return '#e74c3c';
            }

            if (c === 'Aprovado' && d === 'Aprovado') {
                return '#2ecc8f';
            }

            return '#f39c12';
        },

        decorateRows: function () {
            if (!this.collection) {
                return;
            }

            this.collection.each(function (model) {
                var $row = this.$el.find('tr[data-id="' + model.id + '"]');

                if ($row.length) {
                    $row.find('td:first-child').css('border-left-color', this.statusColor(model));
                }
            }, this);
        },

        afterRender: function () {
            Dep.prototype.afterRender.call(this);

            this.injectCss();
            this.$el.addClass('pf-wow');

            this.decorateRows();

            // Re-apply after the record list finishes rendering / on data change
            setTimeout(this.decorateRows.bind(this), 400);

            if (this.collection) {
                this.listenTo(this.collection, 'sync', function () {
                    setTimeout(this.decorateRows.bind(this), 50);
                }.bind(this));
            }
        }
    });
});
