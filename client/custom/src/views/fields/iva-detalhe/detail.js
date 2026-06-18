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
                this.$el.find('.iva-detalhe-root').html('<span style="color:#bbb;font-size:13px;">—</span>');
                return;
            }

            var totalBase = 0, totalIva = 0;
            brackets.forEach(function (b) { totalBase += b.base; totalIva += b.iva; });
            totalBase = Math.round(totalBase * 100) / 100;
            totalIva  = Math.round(totalIva  * 100) / 100;

            var BADGE_COLORS = {
                6:  { bg: '#e8f5e9', text: '#2e7d32', border: '#a5d6a7' },
                13: { bg: '#fff8e1', text: '#f57f17', border: '#ffe082' },
                23: { bg: '#fce4ec', text: '#c62828', border: '#f48fb1' }
            };
            var DEFAULT_COLOR = { bg: '#ede7f6', text: '#4527a0', border: '#ce93d8' };

            var rows = brackets.map(function (b) {
                var c = BADGE_COLORS[b.taxa] || DEFAULT_COLOR;
                return (
                    '<div style="display:flex;align-items:center;gap:12px;padding:7px 12px;' +
                    'border-bottom:1px solid #f0f0f0;">' +
                        '<span style="display:inline-block;min-width:52px;text-align:center;' +
                        'padding:2px 8px;border-radius:12px;font-size:12px;font-weight:700;' +
                        'background:' + c.bg + ';color:' + c.text + ';border:1px solid ' + c.border + ';">' +
                        b.taxa + '%</span>' +
                        '<span style="flex:1;font-size:13px;color:#777;">Base</span>' +
                        '<span style="font-size:13px;color:#444;min-width:70px;text-align:right;">' +
                        b.base.toFixed(2) + ' €</span>' +
                        '<span style="font-size:13px;color:#555;min-width:30px;text-align:center;">→</span>' +
                        '<span style="font-size:13px;font-weight:600;color:#1a73e8;min-width:64px;text-align:right;">' +
                        b.iva.toFixed(2) + ' €</span>' +
                    '</div>'
                );
            }).join('');

            var html =
                '<div style="border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;' +
                'background:#fff;max-width:420px;box-shadow:0 1px 3px rgba(0,0,0,.06);">' +
                    '<div style="background:#f5f7fa;padding:6px 12px;border-bottom:1px solid #e0e0e0;' +
                    'display:flex;justify-content:space-between;align-items:center;">' +
                        '<span style="font-size:11px;font-weight:700;color:#888;text-transform:uppercase;' +
                        'letter-spacing:.6px;">Taxa</span>' +
                        '<span style="font-size:11px;font-weight:700;color:#888;text-transform:uppercase;' +
                        'letter-spacing:.6px;margin-left:auto;margin-right:0;">Base&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;IVA</span>' +
                    '</div>' +
                    rows +
                    '<div style="display:flex;align-items:center;gap:12px;padding:8px 12px;' +
                    'background:#f9f9f9;">' +
                        '<span style="flex:1;font-size:12px;font-weight:700;color:#555;">TOTAL IVA</span>' +
                        '<span style="font-size:13px;color:#444;min-width:70px;text-align:right;">' +
                        totalBase.toFixed(2) + ' €</span>' +
                        '<span style="font-size:13px;color:#555;min-width:30px;text-align:center;">→</span>' +
                        '<span style="font-size:14px;font-weight:700;color:#d32f2f;min-width:64px;text-align:right;">' +
                        totalIva.toFixed(2) + ' €</span>' +
                    '</div>' +
                '</div>';

            this.$el.find('.iva-detalhe-root').html(html);
        }
    });
});
