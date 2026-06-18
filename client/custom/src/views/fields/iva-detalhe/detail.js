define('custom:views/fields/iva-detalhe/detail', ['views/fields/base'], function (Dep) {

    return Dep.extend({

        templateContent: '<div class="iva-detalhe-root"></div>',

        afterRender: function () {
            Dep.prototype.afterRender.call(this);
            this._renderBreakdown();
            this.listenTo(this.model, 'change:ivadetalhes', this._renderBreakdown.bind(this));
        },

        _renderBreakdown: function () {
            var raw = this.model.get('ivadetalhes') || '';
            var brackets = [];
            try { brackets = JSON.parse(raw); } catch (e) {}

            if (!brackets.length) {
                this.$el.find('.iva-detalhe-root').html('<span style="color:#aaa;">—</span>');
                return;
            }

            var totalIva = 0;
            var html = '<table style="font-size:13px;border-collapse:collapse;min-width:220px;">';
            brackets.forEach(function (b) {
                totalIva += b.iva;
                html +=
                    '<tr>' +
                        '<td style="padding:3px 12px 3px 0;color:#555;white-space:nowrap;">IVA ' + b.taxa + '%</td>' +
                        '<td style="padding:3px 12px 3px 0;color:#777;white-space:nowrap;">Base&nbsp;' + b.base.toFixed(2) + '&nbsp;€</td>' +
                        '<td style="padding:3px 0;color:#2980b9;font-weight:600;white-space:nowrap;">' + b.iva.toFixed(2) + '&nbsp;€</td>' +
                    '</tr>';
            });
            totalIva = Math.round(totalIva * 100) / 100;
            html +=
                '<tr style="border-top:1px solid #ddd;">' +
                    '<td colspan="2" style="padding:4px 12px 2px 0;color:#555;font-size:12px;font-weight:600;">Total IVA</td>' +
                    '<td style="padding:4px 0 2px;color:#e74c3c;font-weight:700;white-space:nowrap;">' + totalIva.toFixed(2) + '&nbsp;€</td>' +
                '</tr>' +
            '</table>';

            this.$el.find('.iva-detalhe-root').html(html);
        }
    });
});
