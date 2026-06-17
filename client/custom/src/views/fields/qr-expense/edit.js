define('custom:views/fields/qr-expense/edit', ['views/fields/base'], function (Dep) {

    var SCAN_TIMEOUT_SEC = 15;
    var JSQR_CDN = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';

    return Dep.extend({

        templateContent: `
            <div class="qr-expense-wrap" style="font-family:inherit;">

                {{#unless scanning}}
                    {{#if qrRead}}
                        <button class="btn btn-success qr-scan-btn" type="button" style="margin-bottom:8px;">
                            <span class="fas fa-check" style="margin-right:6px;"></span>QR lido
                        </button>
                    {{else}}
                        <button class="btn btn-primary qr-scan-btn" type="button" style="margin-bottom:8px;">
                            <span class="fas fa-qrcode" style="margin-right:6px;"></span>Scan Fatura
                        </button>
                    {{/if}}
                {{/unless}}

                <div class="qr-camera-area" style="display:none;position:relative;max-width:400px;">
                    <video class="qr-video" autoplay playsinline muted
                        style="width:100%;border-radius:8px;background:#000;display:block;"></video>

                    <canvas class="qr-canvas" style="display:none;"></canvas>

                    <div class="qr-overlay" style="position:absolute;inset:0;display:flex;align-items:center;
                        justify-content:center;pointer-events:none;">
                        <div style="width:60%;aspect-ratio:1;border:3px solid rgba(74,144,217,.8);
                            border-radius:12px;box-shadow:0 0 0 2000px rgba(0,0,0,.35);"></div>
                    </div>

                    <div class="qr-countdown" style="position:absolute;top:10px;right:12px;
                        background:rgba(0,0,0,.6);color:#fff;border-radius:20px;
                        padding:4px 12px;font-size:13px;font-weight:600;">
                        <span class="fas fa-clock" style="margin-right:4px;"></span>
                        <span class="qr-countdown-val">15</span>s
                    </div>

                    <button class="btn btn-default qr-cancel-btn" type="button"
                        style="position:absolute;bottom:10px;left:50%;transform:translateX(-50%);
                        background:rgba(0,0,0,.55);color:#fff;border:none;border-radius:20px;
                        padding:6px 18px;font-size:13px;">
                        Cancelar
                    </button>
                </div>

                {{#if attachmentName}}
                    <div class="qr-attach-info" style="margin-top:6px;font-size:13px;color:#555;">
                        <span class="fas fa-paperclip" style="color:#4a90d9;margin-right:5px;"></span>
                        {{attachmentName}}
                    </div>
                {{/if}}

                {{#if errorMsg}}
                    <div style="color:#e74c3c;font-size:13px;margin-top:6px;">
                        <span class="fas fa-exclamation-triangle" style="margin-right:4px;"></span>
                        {{errorMsg}}
                    </div>
                {{/if}}
            </div>
        `,

        data: function () {
            return {
                scanning: this._scanning || false,
                qrRead: this._qrRead || false,
                attachmentName: this.model.get('documentocontabName') || null,
                errorMsg: this._errorMsg || null
            };
        },

        setup: function () {
            Dep.prototype.setup.call(this);
            this._scanning = false;
            this._qrRead = false;
            this._errorMsg = null;
            this._stream = null;
            this._rafId = null;
            this._countdownInterval = null;
            this._timeoutHandle = null;
            this._jsqrLoaded = false;
        },

        afterRender: function () {
            Dep.prototype.afterRender.call(this);

            this.$el.find('.qr-scan-btn').on('click', function () {
                this._startScan();
            }.bind(this));

            this.$el.find('.qr-cancel-btn').on('click', function () {
                this._stopCamera();
                this._scanning = false;
                this.reRender();
            }.bind(this));
        },

        _loadJsQR: function (callback) {
            if (window.jsQR) {
                callback();
                return;
            }

            var script = document.createElement('script');
            script.src = JSQR_CDN;
            script.onload = function () {
                callback();
            };
            script.onerror = function () {
                this._showError('Erro ao carregar jsQR. Verifica a ligação à internet.');
            }.bind(this);

            document.head.appendChild(script);
        },

        _startScan: function () {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                this._showError('Camera não suportada neste browser. Usa HTTPS e um browser moderno.');
                return;
            }

            this._scanning = true;
            this._errorMsg = null;
            this.reRender();

            this._loadJsQR(function () {
                navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: 'environment' } }
                }).then(function (stream) {
                    this._stream = stream;
                    this._startVideoLoop(stream);
                }.bind(this)).catch(function (err) {
                    this._scanning = false;
                    this._showError('Sem acesso à câmara: ' + err.message);
                }.bind(this));
            }.bind(this));
        },

        _startVideoLoop: function (stream) {
            var $area = this.$el.find('.qr-camera-area');
            $area.show();

            var video = this.$el.find('.qr-video')[0];
            video.srcObject = stream;
            video.play();

            var canvas = this.$el.find('.qr-canvas')[0];
            var ctx = canvas.getContext('2d');

            var remaining = SCAN_TIMEOUT_SEC;
            var $countVal = this.$el.find('.qr-countdown-val');

            this._countdownInterval = setInterval(function () {
                remaining -= 1;
                $countVal.text(remaining);

                if (remaining <= 0) {
                    clearInterval(this._countdownInterval);
                    this._onTimeout(canvas, ctx, video);
                }
            }.bind(this), 1000);

            var self = this;

            var tick = function () {
                if (!self._scanning) {
                    return;
                }

                if (video.readyState === video.HAVE_ENOUGH_DATA) {
                    canvas.width  = video.videoWidth;
                    canvas.height = video.videoHeight;
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    var code = window.jsQR(imageData.data, imageData.width, imageData.height, {
                        inversionAttempts: 'dontInvert'
                    });

                    if (code && code.data) {
                        var parsed = self._parseQrAT(code.data);

                        if (parsed) {
                            clearInterval(self._countdownInterval);
                            self._applyParsed(parsed);
                            self._captureAndUpload(canvas, true);
                            return;
                        }
                    }
                }

                self._rafId = requestAnimationFrame(tick);
            };

            this._rafId = requestAnimationFrame(tick);
        },

        _onTimeout: function (canvas, ctx, video) {
            if (video.readyState >= video.HAVE_ENOUGH_DATA) {
                canvas.width  = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            }

            this._captureAndUpload(canvas, false);
        },

        _parseQrAT: function (raw) {
            if (!raw || raw.indexOf('A:') === -1 || raw.indexOf('O:') === -1) {
                return null;
            }

            var fields = {};

            raw.split('*').forEach(function (pair) {
                var idx = pair.indexOf(':');
                if (idx > -1) {
                    fields[pair.substring(0, idx)] = pair.substring(idx + 1);
                }
            });

            var nif    = fields['A'] || '';
            var total  = parseFloat(fields['O'] || '0') || 0;

            // Pick the largest base/IVA pair from I2/I3, I4/I5, I6/I7
            var bases = [
                { base: parseFloat(fields['I2'] || '0'), iva: parseFloat(fields['I3'] || '0') },
                { base: parseFloat(fields['I4'] || '0'), iva: parseFloat(fields['I5'] || '0') },
                { base: parseFloat(fields['I6'] || '0'), iva: parseFloat(fields['I7'] || '0') }
            ];

            var dominant = bases.reduce(function (best, cur) {
                return cur.base > best.base ? cur : best;
            }, { base: 0, iva: 0 });

            var subtotal = dominant.base;
            var iva      = dominant.iva;
            var taxaiva  = (subtotal > 0)
                ? Math.round((iva / subtotal) * 100)
                : 0;

            return { nif: nif, subtotal: subtotal, iva: iva, taxaiva: taxaiva, total: total };
        },

        _applyParsed: function (parsed) {
            this.model.set('nifdocumento', parsed.nif);
            this.model.set('subtotal',     parsed.subtotal);
            this.model.set('iva',          parsed.iva);
            this.model.set('taxaiva',      parsed.taxaiva);
            this.model.set('total',        parsed.total);
        },

        _captureAndUpload: function (canvas, qrSuccess) {
            var self = this;

            canvas.toBlob(function (blob) {
                self._stopCamera();
                self._scanning = false;

                if (!blob) {
                    self._qrRead = qrSuccess;
                    self.reRender();
                    return;
                }

                self._uploadAttachment(blob, qrSuccess);
            }, 'image/jpeg', 0.85);
        },

        _uploadAttachment: function (blob, qrSuccess) {
            var self = this;
            var fileName = 'fatura-' + Date.now() + '.jpg';

            var xhr = new XMLHttpRequest();
            xhr.open('POST', window.location.origin + '/api/v1/Attachment');
            xhr.setRequestHeader('X-Espo-Authorization', this._getAuthHeader());
            xhr.setRequestHeader('Content-Type', 'application/json');

            xhr.onload = function () {
                if (xhr.status === 200 || xhr.status === 201) {
                    try {
                        var resp = JSON.parse(xhr.responseText);

                        if (resp.id) {
                            self.model.set('documentocontabId',   resp.id);
                            self.model.set('documentocontabName', resp.name || fileName);
                        }
                    } catch (e) {}
                }

                self._qrRead = qrSuccess;
                self.reRender();
            };

            xhr.onerror = function () {
                self._qrRead = qrSuccess;
                self.reRender();
            };

            var payload = {
                name:          fileName,
                type:          'image/jpeg',
                parentType:    'Contabdoc',
                role:          'Attachment',
                file:          null
            };

            // Convert blob to base64 and send
            var reader = new FileReader();
            reader.onload = function (e) {
                payload.file = e.target.result;
                xhr.send(JSON.stringify(payload));
            };
            reader.readAsDataURL(blob);
        },

        _getAuthHeader: function () {
            // Use the EspoCRM session token from the app
            try {
                var auth = this.getHelper().getAppParam('auth') ||
                           this.getHelper().getAppParam('token');

                if (auth) {
                    return auth;
                }
            } catch (e) {}

            // Fallback: read from cookie or localStorage
            var token = document.cookie.split(';').map(function (c) {
                return c.trim();
            }).filter(function (c) {
                return c.startsWith('auth-token=');
            }).map(function (c) {
                return c.split('=')[1];
            })[0];

            return token || '';
        },

        _stopCamera: function () {
            if (this._rafId) {
                cancelAnimationFrame(this._rafId);
                this._rafId = null;
            }

            if (this._countdownInterval) {
                clearInterval(this._countdownInterval);
                this._countdownInterval = null;
            }

            if (this._stream) {
                this._stream.getTracks().forEach(function (t) { t.stop(); });
                this._stream = null;
            }

            var video = this.$el.find('.qr-video')[0];
            if (video) {
                video.srcObject = null;
            }
        },

        _showError: function (msg) {
            this._errorMsg = msg;
            this._scanning = false;
            this.reRender();
        },

        onRemove: function () {
            this._stopCamera();
            Dep.prototype.onRemove.call(this);
        }
    });
});
