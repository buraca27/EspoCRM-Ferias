define('custom:views/periodo-ferias/fields/timeline', ['views/fields/base'], function (Dep) {

    return Dep.extend({

        templateContent: '<div class="pf-timeline-root" style="width:100%;">' +
            '<div class="pf-timeline-body" style="color:#888;font-size:12px;">...</div>' +
            '</div>',

        monthsPt: ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'],

        injectResponsiveCss: function () {
            if (document.getElementById('pf-tl-responsive-css')) {
                return;
            }

            var css = '@media screen and (max-width: 900px) {' +
                '.pf-timeline-body { font-size: 11px !important; }' +
                '.pf-tl-bar { height: 22px !important; }' +
                '}' +
                '@media screen and (max-width: 600px) {' +
                '.pf-timeline-body { font-size: 10px !important; }' +
                '.pf-tl-bar { height: 18px !important; }' +
                '}';

            var style = document.createElement('style');
            style.id = 'pf-tl-responsive-css';
            style.appendChild(document.createTextNode(css));
            document.head.appendChild(style);
        },

        afterRender: function () {
            Dep.prototype.afterRender.call(this);

            this.injectResponsiveCss();

            if (this.mode === 'edit' || this.mode === 'search') {
                return;
            }

            try {
                this.build();
            } catch (e) {
                console.error('PeriodoFerias timeline error', e);
            }
        },

        parseDate: function (value) {
            if (!value) {
                return null;
            }

            var p = String(value).substring(0, 10).split('-');

            if (p.length !== 3) {
                return null;
            }

            var y = parseInt(p[0], 10);
            var m = parseInt(p[1], 10);
            var d = parseInt(p[2], 10);

            if (isNaN(y) || isNaN(m) || isNaN(d)) {
                return null;
            }

            return new Date(y, m - 1, d);
        },

        dayOfYear: function (date) {
            return Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
        },

        formatDM: function (date) {
            return ('0' + date.getDate()).slice(-2) + '/' + ('0' + (date.getMonth() + 1)).slice(-2);
        },

        build: function () {
            var s = this.parseDate(this.model.get('dateStartDate') || this.model.get('dateStart'));
            var e = this.parseDate(this.model.get('dateEndDate') || this.model.get('dateEnd'));

            if (!s || !e) {
                this.$el.find('.pf-timeline-body').html(
                    '<span style="color:#999;">Sem datas definidas.</span>'
                );
                return;
            }

            var year = s.getFullYear();
            this.calYear = year;

            var totalDays = ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? 366 : 365;

            // Month labels
            var labelsHtml = '<div style="display:flex;font-size:10px;color:#999;margin-bottom:3px;">';
            this.monthsPt.forEach(function (m) {
                labelsHtml += '<div style="flex:1;text-align:left;padding-left:2px;">' + m + '</div>';
            });
            labelsHtml += '</div>';

            // Bar
            var barHtml = '<div class="pf-tl-wrap" style="position:relative;cursor:pointer;" ' +
                'title="Abrir calendário">';
            barHtml += '<div style="position:relative;height:28px;background:#f0f0f0;border-radius:3px;' +
                'overflow:visible;border:1px solid #e2e2e2;">';

            for (var i = 1; i < 12; i++) {
                barHtml += '<div style="position:absolute;top:0;bottom:0;left:' + ((i / 12) * 100) +
                    '%;width:1px;background:#e0e0e0;"></div>';
            }

            var sd = this.dayOfYear(s);
            var ed = this.dayOfYear(e);

            if (ed < sd) {
                ed = sd;
            }

            var spanDays = (ed - sd) + 1;
            var left = ((sd - 1) / totalDays) * 100;
            var width = (spanDays / totalDays) * 100;

            if (width < 0.6) {
                width = 0.6;
            }

            var chefia = this.model.get('aprovacaoChefia') || '';
            var direcao = this.model.get('aprovadirecao') || '';
            var daf = this.model.get('conferidoDAF') || '—';

            // Color by approval status
            var segColor = '#2ecc8f';
            if (chefia === 'Recusado' || direcao === 'Recusado') {
                segColor = '#e74c3c';
            } else if (chefia === 'Pendente' || direcao === 'Pendente') {
                segColor = '#f39c12';
            }

            barHtml += '<div class="pf-tl-seg" style="position:absolute;top:3px;bottom:3px;left:' + left +
                '%;width:' + width + '%;background:' + segColor + ';border-radius:2px;' +
                'box-shadow:0 1px 2px rgba(0,0,0,0.15);"></div>';

            // Today marker
            var today = new Date();
            if (today.getFullYear() === year) {
                var todayDoy = this.dayOfYear(today);
                var todayLeft = ((todayDoy - 1) / totalDays) * 100;
                barHtml += '<div title="Hoje" style="position:absolute;top:-3px;bottom:-3px;left:' + todayLeft +
                    '%;width:2px;background:#e74c3c;z-index:2;border-radius:1px;"></div>';
                barHtml += '<div style="position:absolute;top:-8px;left:' + todayLeft +
                    '%;transform:translateX(-50%);width:6px;height:6px;background:#e74c3c;' +
                    'border-radius:50%;z-index:2;"></div>';
            }

            barHtml += '</div>'; // bar

            // Tooltip
            barHtml += '<div class="pf-tl-tip" style="display:none;position:absolute;z-index:1000;bottom:100%;' +
                'left:' + (left + width / 2) + '%;margin-bottom:9px;transform:translateX(-50%);' +
                'background:#2b2f33;color:#fff;padding:8px 11px;border-radius:6px;font-size:12px;' +
                'line-height:1.5;white-space:nowrap;box-shadow:0 4px 14px rgba(0,0,0,0.3);pointer-events:none;">' +
                '<div style="font-weight:600;margin-bottom:3px;">📅 ' + this.formatDM(s) + ' → ' +
                this.formatDM(e) + '</div>' +
                '<div>Chefia: <b>' + chefia + '</b></div>' +
                '<div>Direção: <b>' + direcao + '</b></div>' +
                '<div>DAF: ' + daf + '</div>' +
                '<div style="position:absolute;top:100%;left:50%;transform:translateX(-50%);' +
                'border:6px solid transparent;border-top-color:#2b2f33;"></div>' +
                '</div>';

            barHtml += '</div>'; // wrap

            var legendHtml = '<div style="margin-top:7px;font-size:12px;color:#666;' +
                'display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;">' +
                '<span>' +
                '<span style="color:' + segColor + ';font-weight:600;">' + spanDays + '</span> dias neste período' +
                '&nbsp;&nbsp;' +
                '<span style="display:inline-flex;align-items:center;gap:3px;">' +
                '<span style="display:inline-block;width:2px;height:10px;background:#e74c3c;border-radius:1px;"></span>Hoje' +
                '</span>' +
                '</span>' +
                '<span class="pf-open-cal" style="font-size:12px;color:#4a90d9;cursor:pointer;">' +
                '<span class="fas fa-calendar-alt" style="margin-right:5px;"></span>Abrir calendário</span>' +
                '</div>';

            this.$el.find('.pf-timeline-body').html(labelsHtml + barHtml + legendHtml);

            // Tooltip hover
            var $tip = this.$el.find('.pf-tl-tip');
            this.$el.find('.pf-tl-seg')
                .on('mouseenter', function () {
                    $tip.show();
                })
                .on('mouseleave', function () {
                    $tip.hide();
                });

            // Open calendar
            this.$el.find('.pf-tl-wrap, .pf-open-cal').on('click', function (ev) {
                ev.stopPropagation();
                this.openCalendar();
            }.bind(this));
        },

        openCalendar: function () {
            this.createView('calendarModal', 'custom:views/ferias/modals/calendar', {
                year: this.calYear,
                periods: [this.model.attributes],
                feriasId: this.model.get('feriasId'),
                feriasName: this.model.get('feriasName')
            }, function (view) {
                view.render();
            });
        }
    });
});
