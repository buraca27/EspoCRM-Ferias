define('custom:views/ferias/modals/quem-ferias', ['views/modal'], function (Dep) {

    return Dep.extend({

        backdrop: true,

        templateContent: '<div class="ferias-qf-wrap" style="padding:10px 0;">A carregar…</div>',

        // Tabs: 0=hoje, 7=próx. 7 dias, 30=próx. 30 dias
        tabs: [
            { days: 0,  label: 'Hoje' },
            { days: 7,  label: 'Próximos 7 dias' },
            { days: 30, label: 'Próximos 30 dias' }
        ],

        activeTab: 0,

        setup: function () {
            this.headerText = 'Férias';
            this.buttonList = [{ name: 'cancel', label: 'Fechar' }];
            this.fitHeight = true;
        },

        afterRender: function () {
            Dep.prototype.afterRender.call(this);
            this.renderShell();
            this.loadData();
        },

        renderShell: function () {
            var self = this;

            // Tab bar
            var tabHtml = '<div style="display:flex;gap:0;border-bottom:2px solid #e2e8f0;margin-bottom:16px;">';
            this.tabs.forEach(function (tab, idx) {
                var active = idx === self.activeTab;
                tabHtml += '<button class="ferias-qf-tab" data-idx="' + idx + '" ' +
                    'style="background:none;border:none;padding:8px 18px;cursor:pointer;font-size:13px;' +
                    'font-weight:' + (active ? '700' : '400') + ';color:' + (active ? '#4a90d9' : '#888') + ';' +
                    'border-bottom:' + (active ? '2px solid #4a90d9' : '2px solid transparent') + ';' +
                    'margin-bottom:-2px;transition:all .15s;">' +
                    tab.label + '</button>';
            });
            tabHtml += '</div>';

            var shell = tabHtml + '<div class="ferias-qf-body" style="min-height:80px;">A carregar…</div>';
            this.$el.find('.ferias-qf-wrap').html(shell);

            this.$el.find('.ferias-qf-tab').on('click', function () {
                var idx = parseInt($(this).attr('data-idx'), 10);
                if (idx === self.activeTab) return;
                self.activeTab = idx;
                // Update tab styles
                self.$el.find('.ferias-qf-tab').each(function (i) {
                    var isActive = i === idx;
                    $(this).css({
                        'font-weight': isActive ? '700' : '400',
                        'color': isActive ? '#4a90d9' : '#888',
                        'border-bottom': isActive ? '2px solid #4a90d9' : '2px solid transparent'
                    });
                });
                self.$el.find('.ferias-qf-body').html(
                    '<div style="text-align:center;padding:20px;color:#aaa;">A carregar…</div>'
                );
                self.loadData();
            });
        },

        dateStr: function (date) {
            var pad = function (n) { return ('0' + n).slice(-2); };
            return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
        },

        loadData: function () {
            var today = new Date();
            var todayStr = this.dateStr(today);

            var futureDays = this.tabs[this.activeTab].days;
            var rangeEnd = new Date(today);
            rangeEnd.setDate(rangeEnd.getDate() + futureDays);
            var rangeEndStr = this.dateStr(rangeEnd);

            var self = this;

            // Periods that overlap [today, rangeEnd]:
            //   dateStartDate <= rangeEnd  AND  dateEndDate >= today
            Espo.Ajax.getRequest('PeriodoFerias', {
                maxSize: 200,
                select: 'id,dateStartDate,dateEndDate,diasmarcados,aprovacaoChefia,aprovadirecao,feriasId,tipoDias',
                'where[0][type]': 'lessThanOrEquals',
                'where[0][field]': 'dateStartDate',
                'where[0][value]': rangeEndStr,
                'where[1][type]': 'greaterThanOrEquals',
                'where[1][field]': 'dateEndDate',
                'where[1][value]': todayStr
            })
            .then(function (data) {
                var list = data && data.list ? data.list : [];

                if (!list.length) {
                    self.renderResults([], todayStr, rangeEndStr, {});
                    return;
                }

                // Fetch Ferias info for all unique feriasIds
                var feriasIds = [];
                list.forEach(function (item) {
                    if (item.feriasId && feriasIds.indexOf(item.feriasId) === -1) {
                        feriasIds.push(item.feriasId);
                    }
                });

                var params = {
                    maxSize: 200,
                    select: 'id,nomeCompleto,seccao,localTrabalho',
                    'where[0][type]': 'in',
                    'where[0][field]': 'id'
                };
                feriasIds.forEach(function (fid, i) {
                    params['where[0][value][' + i + ']'] = fid;
                });

                Espo.Ajax.getRequest('Ferias', params)
                .then(function (feriasData) {
                    var feriasMap = {};
                    if (feriasData && feriasData.list) {
                        feriasData.list.forEach(function (f) { feriasMap[f.id] = f; });
                    }
                    self.renderResults(list, todayStr, rangeEndStr, feriasMap);
                })
                .catch(function () {
                    self.renderResults(list, todayStr, rangeEndStr, {});
                });
            })
            .catch(function () {
                self.$el.find('.ferias-qf-body').html(
                    '<div style="color:#c0392b;padding:20px;text-align:center;">Erro ao carregar dados.</div>'
                );
            });
        },

        formatDate: function (str) {
            if (!str) return '—';
            var p = String(str).substring(0, 10).split('-');
            return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : str;
        },

        getStatusBadge: function (chefia, direcao) {
            if (chefia === 'Recusado' || direcao === 'Recusado') {
                return '<span style="background:#e74c3c;color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;">Recusado</span>';
            }
            if (chefia === 'Aprovado' && direcao === 'Aprovado') {
                return '<span style="background:#2ecc8f;color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;">Aprovado</span>';
            }
            return '<span style="background:#f39c12;color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;">Pendente</span>';
        },

        renderResults: function (list, todayStr, rangeEndStr, feriasMap) {
            var $body = this.$el.find('.ferias-qf-body');
            feriasMap = feriasMap || {};

            var futureDays = this.tabs[this.activeTab].days;
            var isToday = futureDays === 0;

            if (!list.length) {
                var emptyMsg = isToday ? 'Ninguém de férias hoje' : 'Ninguém de férias nos próximos ' + futureDays + ' dias';
                $body.html(
                    '<div style="text-align:center;padding:40px 20px;color:#888;">' +
                    '<div style="font-size:40px;margin-bottom:10px;">🏖️</div>' +
                    '<div style="font-size:15px;font-weight:600;color:#555;">' + emptyMsg + '</div>' +
                    '</div>'
                );
                return;
            }

            // Group periods by feriasId
            var groups = {};
            var groupOrder = [];
            list.forEach(function (item) {
                var key = item.feriasId || '_unknown';
                if (!groups[key]) {
                    groups[key] = { feriasId: item.feriasId, periods: [] };
                    groupOrder.push(key);
                }
                groups[key].periods.push(item);
            });

            // Sort each group's periods by start date
            groupOrder.forEach(function (key) {
                groups[key].periods.sort(function (a, b) {
                    return (a.dateStartDate || '').localeCompare(b.dateStartDate || '');
                });
            });

            var peopleCount = groupOrder.length;
            var countLabel = isToday
                ? '<strong>' + peopleCount + '</strong> pessoa' + (peopleCount !== 1 ? 's' : '') + ' de férias hoje'
                : '<strong>' + peopleCount + '</strong> pessoa' + (peopleCount !== 1 ? 's' : '') +
                  ' de férias entre <strong>' + this.formatDate(todayStr) + '</strong> e <strong>' + this.formatDate(rangeEndStr) + '</strong>';

            var html = '<div style="margin-bottom:14px;font-size:13px;color:#666;text-align:center;">' + countLabel + '</div>';
            // Store groups data on the view instance for calendar access
            this._groupsData = groups;
            this._groupsFeriasMap = feriasMap;

            html += '<div style="display:flex;flex-direction:column;gap:12px;">';

            groupOrder.forEach(function (key) {
                var group = groups[key];
                var ferias = feriasMap[group.feriasId] || {};
                var name = ferias.nomeCompleto || '—';
                var sub = [ferias.seccao, ferias.localTrabalho].filter(Boolean).join(' · ');

                html += '<div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">';

                // Person header with calendar button
                html += '<div style="padding:10px 15px;background:#f4f7fb;border-bottom:1px solid #e2e8f0;' +
                    'display:flex;align-items:center;justify-content:space-between;">' +
                    '<div>' +
                    '<div style="font-weight:700;font-size:14px;color:#222;">' + name + '</div>' +
                    (sub ? '<div style="font-size:11px;color:#999;margin-top:1px;">' + sub + '</div>' : '') +
                    '</div>' +
                    '<button class="ferias-qf-cal-btn btn btn-link" data-group-key="' + key + '" ' +
                    'title="Ver calendário" style="color:#4a90d9;font-size:12px;padding:3px 8px;' +
                    'border:1px solid #d0e4f7;border-radius:6px;background:#fff;cursor:pointer;' +
                    'display:flex;align-items:center;gap:4px;">' +
                    '<span class="fas fa-calendar-alt"></span> Calendário' +
                    '</button>' +
                    '</div>';

                // Each period
                group.periods.forEach(function (item) {
                    var start = this.formatDate(item.dateStartDate);
                    var end = this.formatDate(item.dateEndDate);
                    var dias = item.diasmarcados || '—';
                    var badge = this.getStatusBadge(item.aprovacaoChefia, item.aprovadirecao);

                    var isOngoing = item.dateStartDate <= todayStr;
                    var statusChip = isOngoing
                        ? '<span style="background:#e8f8f1;color:#27ae60;padding:1px 6px;border-radius:6px;font-size:10px;font-weight:600;">A decorrer</span>'
                        : '<span style="background:#eaf2ff;color:#2471a3;padding:1px 6px;border-radius:6px;font-size:10px;font-weight:600;">Próximo</span>';

                    var leftColor = '#2ecc8f';
                    if (item.aprovacaoChefia === 'Recusado' || item.aprovadirecao === 'Recusado') {
                        leftColor = '#e74c3c';
                    } else if (item.aprovacaoChefia !== 'Aprovado' || item.aprovadirecao !== 'Aprovado') {
                        leftColor = '#f39c12';
                    }

                    html += '<div class="ferias-qf-row" data-period-id="' + item.id + '" ' +
                        'style="display:flex;align-items:center;justify-content:space-between;' +
                        'padding:9px 15px 9px 18px;border-left:3px solid ' + leftColor + ';' +
                        'background:#fff;cursor:pointer;transition:background .12s;' +
                        'border-bottom:1px solid #f0f0f0;">' +
                        '<div style="display:flex;align-items:center;gap:8px;">' +
                        statusChip +
                        '<span style="font-size:12px;color:#555;">' +
                        start + ' → ' + end + ' &nbsp;·&nbsp; ' + dias + ' dias' +
                        '</span>' +
                        '</div>' +
                        '<div style="display:flex;align-items:center;gap:8px;">' +
                        badge +
                        '<span style="color:#4a90d9;font-size:16px;">›</span>' +
                        '</div>' +
                        '</div>';
                }, this);

                html += '</div>'; // group card
            }, this);

            html += '</div>';
            $body.html(html);

            $body.find('.ferias-qf-row')
                .on('mouseenter', function () { $(this).css('background', '#f0f5ff'); })
                .on('mouseleave', function () { $(this).css('background', '#fff'); })
                .on('click', function (e) {
                    var periodId = $(e.currentTarget).attr('data-period-id');
                    if (!periodId) return;
                    this.close();
                    setTimeout(function () {
                        this.getRouter().navigate('PeriodoFerias/view/' + periodId, {trigger: true});
                    }.bind(this), 200);
                }.bind(this));

            $body.find('.ferias-qf-cal-btn').on('click', function (e) {
                e.stopPropagation();
                var key = $(e.currentTarget).attr('data-group-key');
                this.openPersonCalendar(key);
            }.bind(this));
        },

        openPersonCalendar: function (groupKey) {
            var group = this._groupsData && this._groupsData[groupKey];
            if (!group) return;

            var periods = group.periods || [];
            var year = new Date().getFullYear();

            // Pick the year of the first period (most relevant)
            if (periods.length) {
                var firstDate = periods[0].dateStartDate || periods[0].dateStart || '';
                if (firstDate) year = parseInt(firstDate.substring(0, 4), 10) || year;
            }

            this.createView('personCalendar', 'custom:views/ferias/modals/calendar', {
                year: year,
                periods: periods
            }, function (view) {
                view.render();
            });
        }
    });
});
