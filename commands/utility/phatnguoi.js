const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const axios = require("axios");
const { wrapper } = require("axios-cookiejar-support");
const { CookieJar } = require("tough-cookie");

const CSGT_CONFIG = {
        BASE_URL: "https://www.csgt.vn",
        CAPTCHA_URL: "https://www.csgt.vn/lib/captcha/captcha.class.php",
        FORM_ENDPOINT: "/?mod=contact&task=tracuu_post&ajax",
        RESULTS_URL: "https://www.csgt.vn/tra-cuu-phuong-tien-vi-pham.html"
};

module.exports = {
        data: {
                name: "phatnguoi",
                description: "Tra cứu phạt nguội giao thông (CSGT)",
                type: 1,
                options: [
                        {
                                name: "bienso",
                                description: "Biển số xe (VD: 30A12345 hoặc nhiều biển: 30A12345, 51B67890)",
                                type: 3,
                                required: true,
                        },
                        {
                                name: "loaixe",
                                description: "Loại phương tiện",
                                type: 3,
                                required: true,
                                choices: [
                                        { name: "Ô tô", value: "1" },
                                        { name: "Xe máy", value: "2" },
                                        { name: "Xe điện", value: "3" },
                                ],
                        },
                ],
                integration_types: [0, 1],
                contexts: [0, 1, 2],
        },

        /**
         * Hàm thực thi chính của lệnh
         * Xử lý input, tra cứu vi phạm và hiển thị kết quả
         */
        async execute({ interaction, lang }) {
                await interaction.deferReply();

                const bienSoInput = interaction.options.getString("bienso");
                const loaiXe = interaction.options.getString("loaixe");
                
                // Xử lý input: tách nhiều biển số, loại bỏ ký tự đặc biệt
                const bienSoList = bienSoInput
                        .split(/[,\s]+/)
                        .map(bs => bs.replace(/[\s\-\.]/g, "").trim())
                        .filter(bs => bs.length > 0);

                // Validate số lượng biển số
                if (bienSoList.length === 0) {
                        return interaction.editReply({
                                content: "❌ Vui lòng nhập biển số hợp lệ.",
                        });
                }

                if (bienSoList.length > 5) {
                        return interaction.editReply({
                                content: "❌ Chỉ được tra cứu tối đa 5 biển số cùng lúc. Vui lòng thử lại.",
                        });
                }

                console.log(`[PHATNGUOI] Tra cứu ${bienSoList.length} biển số:`, bienSoList);

                try {
                        // Khởi tạo cookie jar để duy trì session
                        const cookieJar = new CookieJar();
                        const axiosClient = wrapper(axios.create({ jar: cookieJar }));
                        
                        const results = [];
                        
                        // Tra cứu từng biển số
                        for (let i = 0; i < bienSoList.length; i++) {
                                const bienSo = bienSoList[i];
                                console.log(`\n[PHATNGUOI] === Tra cứu biển số ${i + 1}/${bienSoList.length}: ${bienSo} ===`);
                                
                                const result = await this.checkSinglePlate(axiosClient, bienSo, loaiXe);
                                results.push({ bienSo, ...result });
                                
                                // Delay 1s giữa các request để tránh bị chặn
                                if (i < bienSoList.length - 1) {
                                        await new Promise(resolve => setTimeout(resolve, 1000));
                                }
                        }

                        return this.displayMultiPlateResults(interaction, results, loaiXe);

                } catch (error) {
                        console.error("[PHATNGUOI] ❌ Lỗi khi tra cứu phạt nguội:", error.message);
                        console.error("[PHATNGUOI] Stack:", error.stack);
                        return interaction.editReply({
                                content: "❌ Có lỗi xảy ra khi tra cứu thông tin. Vui lòng thử lại sau.",
                        });
                }
        },

        /**
         * Tra cứu vi phạm cho 1 biển số
         * @param {Object} axiosClient - Axios instance với cookie jar
         * @param {string} bienSo - Biển số xe
         * @param {string} loaiXe - Loại xe (1: Ô tô, 2: Xe máy, 3: Xe điện)
         * @returns {Object} Kết quả tra cứu
         */
        async checkSinglePlate(axiosClient, bienSo, loaiXe) {
                try {
                        // Giải captcha bằng OCR
                        const captchaText = await this.getCaptchaWithOCR(axiosClient);
                        
                        if (!captchaText) {
                                return { success: false, error: "Không thể giải captcha" };
                        }

                        // Tạo form data để gửi request
                        const formData = new URLSearchParams();
                        formData.append('BienKS', bienSo);
                        formData.append('Xe', loaiXe);
                        formData.append('captcha', captchaText);
                        formData.append('ipClient', '0.0.0.0');
                        formData.append('cUrl', loaiXe);

                        console.log(`[PHATNGUOI] Gửi request với captcha: ${captchaText}, biển số: ${bienSo}`);
                        
                        const { data } = await axiosClient.post(
                                `${CSGT_CONFIG.BASE_URL}${CSGT_CONFIG.FORM_ENDPOINT}`,
                                formData,
                                {
                                        headers: {
                                                "Content-Type": "application/x-www-form-urlencoded",
                                                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                                                "Referer": CSGT_CONFIG.BASE_URL,
                                        },
                                }
                        );

                        // Kiểm tra captcha sai
                        if (data === "404" || data === 404) {
                                console.log(`[PHATNGUOI] ❌ Captcha sai - Response 404`);
                                return { success: false, error: "Captcha không chính xác" };
                        }

                        // Parse response (có thể là JSON hoặc HTML)
                        let responseData = data;
                        if (typeof responseData === 'string') {
                                responseData = responseData.replace(/\s+/g, "");
                                try {
                                        responseData = JSON.parse(responseData);
                                } catch (e) {
                                        console.log(`[PHATNGUOI] Not JSON, treating as HTML`);
                                }
                        }

                        // Xử lý định dạng mới (có redirect URL)
                        if (typeof responseData === 'object' && responseData.success === 'true' && responseData.href) {
                                console.log(`[PHATNGUOI] ✅ NEW FORMAT: Redirect URL = ${responseData.href}`);
                                
                                const redirectResponse = await axiosClient.get(responseData.href, {
                                        headers: {
                                                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                                                "Referer": CSGT_CONFIG.BASE_URL,
                                        },
                                });

                                if (redirectResponse.data.includes("Không có vi phạm")) {
                                        console.log(`[PHATNGUOI] ✅ Không có vi phạm`);
                                        return { success: true, violations: [], url: responseData.href };
                                }

                                const violations = this.parseViolationsNewFormat(redirectResponse.data);
                                console.log(`[PHATNGUOI] Số vi phạm: ${violations ? violations.length : 0}`);

                                if (violations && violations.length > 0) {
                                        return { success: true, violations, url: responseData.href };
                                }

                                return { success: true, violations: [], url: responseData.href };
                        }

                        // Xử lý định dạng cũ (HTML trực tiếp)
                        if (typeof data === 'string' && data.includes("Không có vi phạm")) {
                                console.log(`[PHATNGUOI] ✅ Không có vi phạm (OLD FORMAT)`);
                                return { success: true, violations: [] };
                        }

                        const violations = this.parseViolations(data);
                        console.log(`[PHATNGUOI] Số vi phạm (OLD): ${violations ? violations.length : 0}`);
                        
                        if (violations && violations.length > 0) {
                                return { success: true, violations, url: CSGT_CONFIG.RESULTS_URL };
                        }

                        return { success: true, violations: [] };

                } catch (error) {
                        console.error(`[PHATNGUOI] Lỗi khi tra ${bienSo}:`, error.message);
                        return { success: false, error: error.message };
                }
        },

        /**
         * Hiển thị kết quả tra cứu với phân trang
         * @param {Object} interaction - Discord interaction
         * @param {Array} results - Kết quả tra cứu từng biển số
         * @param {string} loaiXe - Loại xe
         */
        async displayMultiPlateResults(interaction, results, loaiXe) {
                const totalViolations = results.reduce((sum, r) => sum + (r.violations?.length || 0), 0);
                const platesWithViolations = results.filter(r => r.violations?.length > 0).length;

                // Màu sắc cho các embed vi phạm (10 màu xoay vòng)
                const colors = ["Red", "Orange", "Yellow", "Blue", "Purple", "Green", "DarkRed", "DarkOrange", "DarkBlue", "DarkPurple"];

                // Tạo embed tổng quan
                const summaryEmbed = new EmbedBuilder()
                        .setColor(totalViolations > 0 ? "Red" : "Green")
                        .setTitle(totalViolations > 0 ? "⚠️ Kết quả tra cứu phạt nguội" : "✅ Kết quả tra cứu phạt nguội")
                        .setDescription(`**Loại xe:** ${this.getLoaiXeName(loaiXe)}\n**Số biển tra cứu:** ${results.length}\n**Biển có vi phạm:** ${platesWithViolations}\n**Tổng vi phạm:** ${totalViolations}`)
                        .setTimestamp()
                        .setFooter({
                                text: `Yêu cầu bởi ${interaction.user.username} | Dữ liệu từ CSGT.vn`,
                                iconURL: interaction.user.displayAvatarURL({ size: 1024 }),
                        });

                const allEmbeds = [];
                
                // Tạo embed cho từng kết quả
                results.forEach((result) => {
                        const { bienSo, success, violations, url, error } = result;
                        
                        if (!success) {
                                // Embed lỗi
                                const errorEmbed = new EmbedBuilder()
                                        .setColor("Red")
                                        .setTitle(`❌ ${bienSo}`)
                                        .setDescription(`Lỗi: ${error || "Không xác định"}`);
                                allEmbeds.push(errorEmbed);
                        } else if (violations.length === 0) {
                                // Embed không có vi phạm
                                const noViolationEmbed = new EmbedBuilder()
                                        .setColor("Green")
                                        .setTitle(`✅ ${bienSo}`)
                                        .setDescription("Không có vi phạm");
                                allEmbeds.push(noViolationEmbed);
                        } else {
                                // Embed cho từng vi phạm
                                violations.forEach((v, i) => {
                                        const colorIndex = i % colors.length;
                                        const violationEmbed = new EmbedBuilder()
                                                .setColor(colors[colorIndex])
                                                .setTitle(`⚠️ ${bienSo} - Vi phạm ${i + 1}/${violations.length}`)
                                                .addFields(
                                                        { name: "🚦 Hành vi vi phạm", value: v.hanhVi || "N/A", inline: false },
                                                        { name: "⏰ Thời gian", value: v.thoiGian || "N/A", inline: true },
                                                        { name: "📍 Địa điểm", value: v.diaDiem || "N/A", inline: false },
                                                        { name: "🏢 Đơn vị phát hiện", value: v.donVi || "N/A", inline: true },
                                                        { name: "📋 Trạng thái", value: v.trangThai || "N/A", inline: true }
                                                );

                                        // Thêm link chi tiết cho vi phạm cuối cùng
                                        if (url && i === violations.length - 1) {
                                                violationEmbed.setURL(url);
                                        }

                                        allEmbeds.push(violationEmbed);
                                });
                        }
                });

                // Phân trang: mỗi trang 9 embeds vi phạm (+ 1 embed tổng quan)
                const ITEMS_PER_PAGE = 9;
                const pages = [];
                
                for (let i = 0; i < allEmbeds.length; i += ITEMS_PER_PAGE) {
                        pages.push(allEmbeds.slice(i, i + ITEMS_PER_PAGE));
                }

                // Nếu không có vi phạm, chỉ hiển thị embed tổng quan
                if (pages.length === 0) {
                        return interaction.editReply({ embeds: [summaryEmbed] });
                }

                let currentPage = 0;

                // Hàm tạo embeds cho 1 trang
                const getPageEmbeds = (page) => {
                        const pageEmbeds = [summaryEmbed, ...pages[page]];
                        summaryEmbed.setDescription(
                                `**Loại xe:** ${this.getLoaiXeName(loaiXe)}\n**Số biển tra cứu:** ${results.length}\n**Biển có vi phạm:** ${platesWithViolations}\n**Tổng vi phạm:** ${totalViolations}\n\n📄 **Trang ${page + 1}/${pages.length}**`
                        );
                        return pageEmbeds;
                };

                // Hàm tạo buttons phân trang
                const getButtons = (page) => {
                        const row = new ActionRowBuilder()
                                .addComponents(
                                        new ButtonBuilder()
                                                .setCustomId('prev')
                                                .setLabel('◀️ Trước')
                                                .setStyle(ButtonStyle.Primary)
                                                .setDisabled(page === 0),
                                        new ButtonBuilder()
                                                .setCustomId('page_info')
                                                .setLabel(`Trang ${page + 1}/${pages.length}`)
                                                .setStyle(ButtonStyle.Secondary)
                                                .setDisabled(true),
                                        new ButtonBuilder()
                                                .setCustomId('next')
                                                .setLabel('Sau ▶️')
                                                .setStyle(ButtonStyle.Primary)
                                                .setDisabled(page === pages.length - 1)
                                );
                        return pages.length > 1 ? [row] : [];
                };

                // Gửi trang đầu tiên
                const message = await interaction.editReply({
                        embeds: getPageEmbeds(currentPage),
                        components: getButtons(currentPage)
                });

                // Nếu chỉ có 1 trang, không cần phân trang
                if (pages.length === 1) return;

                // Tạo collector để lắng nghe button clicks (timeout: 5 phút)
                const collector = message.createMessageComponentCollector({
                        filter: i => i.user.id === interaction.user.id,
                        time: 300000
                });

                // Xử lý khi user bấm button
                collector.on('collect', async i => {
                        if (i.customId === 'prev') {
                                currentPage = Math.max(0, currentPage - 1);
                        } else if (i.customId === 'next') {
                                currentPage = Math.min(pages.length - 1, currentPage + 1);
                        }

                        await i.update({
                                embeds: getPageEmbeds(currentPage),
                                components: getButtons(currentPage)
                        });
                });

                // Xóa buttons khi hết thời gian
                collector.on('end', () => {
                        message.edit({ components: [] }).catch(() => {});
                });
        },

        /**
         * Giải captcha bằng OCR API
         * @param {Object} axiosClient - Axios instance
         * @param {number} retryCount - Số lần retry
         * @returns {string|null} Text captcha hoặc null nếu thất bại
         */
        async getCaptchaWithOCR(axiosClient, retryCount = 0) {
                try {
                        const ocrApiKey = process.env.OCR_API_KEY;
                        if (!ocrApiKey) {
                                console.error("[CAPTCHA] ❌ OCR_API_KEY not found in environment variables");
                                return null;
                        }

                        console.log(`[CAPTCHA] Đang lấy captcha từ ${CSGT_CONFIG.CAPTCHA_URL} (Lần thử: ${retryCount + 1})`);

                        // Tải ảnh captcha
                        const captchaResponse = await axiosClient.get(CSGT_CONFIG.CAPTCHA_URL, {
                                responseType: 'arraybuffer',
                                headers: {
                                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                                        "Referer": CSGT_CONFIG.BASE_URL,
                                },
                        });

                        console.log(`[CAPTCHA] Đã lấy captcha, kích thước: ${captchaResponse.data.length} bytes`);

                        // Chuyển sang base64 để gửi OCR
                        const base64Image = Buffer.from(captchaResponse.data, 'binary').toString('base64');

                        // Xoay vòng 2 OCR engines để tăng tỷ lệ thành công
                        const engines = [2, 1];
                        const currentEngine = engines[retryCount % engines.length];

                        console.log(`[CAPTCHA] Sử dụng OCR Engine ${currentEngine}`);

                        // Gửi request đến OCR API
                        const formData = new URLSearchParams();
                        formData.append('apikey', ocrApiKey);
                        formData.append('base64Image', `data:image/png;base64,${base64Image}`);
                        formData.append('language', 'eng');
                        formData.append('isOverlayRequired', 'false');
                        formData.append('OCREngine', currentEngine.toString());
                        formData.append('scale', 'true');
                        formData.append('isTable', 'false');

                        const ocrResponse = await axios.post(
                                "https://api.ocr.space/parse/image",
                                formData,
                                {
                                        headers: {
                                                "Content-Type": "application/x-www-form-urlencoded",
                                        },
                                        timeout: 15000,
                                }
                        );

                        console.log(`[CAPTCHA] OCR Response:`, JSON.stringify(ocrResponse.data, null, 2));

                        // Parse kết quả OCR
                        if (ocrResponse.data?.ParsedResults?.[0]?.ParsedText) {
                                const rawText = ocrResponse.data.ParsedResults[0].ParsedText;
                                const captchaText = rawText
                                        .trim()
                                        .replace(/\s/g, "")
                                        .replace(/[^a-zA-Z0-9]/g, "");
                                
                                console.log(`[CAPTCHA] Raw text: "${rawText}" -> Cleaned: "${captchaText}"`);
                                
                                // Validate độ dài captcha (4-8 ký tự)
                                if (captchaText.length >= 4 && captchaText.length <= 8) {
                                        console.log(`[CAPTCHA] ✅ Captcha giải được: ${captchaText}`);
                                        return captchaText;
                                } else {
                                        console.log(`[CAPTCHA] ⚠️ Captcha không hợp lệ (độ dài ${captchaText.length})`);
                                        if (retryCount < 2) {
                                                console.log(`[CAPTCHA] Thử lại với engine khác...`);
                                                return this.getCaptchaWithOCR(axiosClient, retryCount + 1);
                                        }
                                }
                        }

                        // Xử lý lỗi OCR
                        if (ocrResponse.data?.OCRExitCode === 99) {
                                console.error(`[CAPTCHA] ❌ OCR API Error: ${ocrResponse.data?.ErrorMessage}`);
                        } else if (ocrResponse.data?.IsErroredOnProcessing) {
                                console.error(`[CAPTCHA] ❌ OCR Processing Error: ${ocrResponse.data?.ErrorMessage?.[0] || 'Unknown error'}`);
                        } else {
                                console.error(`[CAPTCHA] ❌ Không thể đọc text từ captcha`);
                        }

                        // Retry tối đa 3 lần
                        if (retryCount < 2) {
                                console.log(`[CAPTCHA] Thử lại lần ${retryCount + 2}...`);
                                await new Promise(resolve => setTimeout(resolve, 1000));
                                return this.getCaptchaWithOCR(axiosClient, retryCount + 1);
                        }

                        return null;
                } catch (error) {
                        console.error(`[CAPTCHA] ❌ Lỗi khi giải captcha (Lần ${retryCount + 1}):`, error.message);
                        
                        if (retryCount < 2) {
                                console.log(`[CAPTCHA] Thử lại sau lỗi...`);
                                await new Promise(resolve => setTimeout(resolve, 1000));
                                return this.getCaptchaWithOCR(axiosClient, retryCount + 1);
                        }
                        
                        return null;
                }
        },

        /**
         * Parse vi phạm từ HTML định dạng mới (form-group)
         * @param {string} htmlData - HTML data
         * @returns {Array} Danh sách vi phạm
         */
        parseViolationsNewFormat(htmlData) {
                try {
                        if (!htmlData || typeof htmlData !== 'string') {
                                return [];
                        }

                        const violations = [];
                        const violationBlocks = htmlData.split(/<div[^>]*class="[^"]*form-group[^"]*"[^>]*>/i);
                        let currentViolation = {};

                        for (let i = 1; i < violationBlocks.length; i++) {
                                const block = violationBlocks[i];
                                
                                // Detect field và extract value
                                if (block.includes('Thời gian vi phạm')) {
                                        // Nếu đã có vi phạm hoàn chỉnh, push vào array
                                        if (currentViolation.thoiGian && currentViolation.hanhVi) {
                                                violations.push({ ...currentViolation });
                                                currentViolation = {};
                                        }
                                        
                                        const match = block.match(/<div[^>]*class="[^"]*col-md-9[^"]*"[^>]*>([^<]+)<\/div>/i);
                                        if (match) {
                                                currentViolation.thoiGian = match[1].trim();
                                        }
                                }
                                else if (block.includes('Địa điểm vi phạm')) {
                                        const match = block.match(/<div[^>]*class="[^"]*col-md-9[^"]*"[^>]*>([^<]+)<\/div>/i);
                                        if (match) {
                                                currentViolation.diaDiem = match[1].trim();
                                        }
                                }
                                else if (block.includes('Hành vi vi phạm')) {
                                        const match = block.match(/<div[^>]*class="[^"]*col-md-9[^"]*"[^>]*>([^<]+)<\/div>/i);
                                        if (match) {
                                                currentViolation.hanhVi = match[1].trim();
                                        }
                                }
                                else if (block.includes('Trạng thái')) {
                                        const match = block.match(/<div[^>]*class="[^"]*col-md-9[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
                                        if (match) {
                                                const cleanStatus = match[1].replace(/<[^>]*>/g, '').trim();
                                                currentViolation.trangThai = cleanStatus;
                                        }
                                }
                                else if (block.includes('Đơn vị phát hiện vi phạm')) {
                                        const match = block.match(/<div[^>]*class="[^"]*col-md-9[^"]*"[^>]*>([^<]+)<\/div>/i);
                                        if (match) {
                                                currentViolation.donVi = match[1].trim();
                                        }
                                }
                                else if (block.includes('Biển số xe') || block.includes('Biển kiểm soát')) {
                                        const match = block.match(/<div[^>]*class="[^"]*col-md-9[^"]*"[^>]*>([^<]+)<\/div>/i);
                                        if (match) {
                                                currentViolation.bienSo = match[1].trim();
                                        }
                                }
                                else if (block.includes('Mức phạt') || block.includes('Số tiền phạt')) {
                                        const match = block.match(/<div[^>]*class="[^"]*col-md-9[^"]*"[^>]*>([^<]+)<\/div>/i);
                                        if (match) {
                                                currentViolation.mucPhat = match[1].trim();
                                        }
                                }
                                else if (block.includes('Số quyết định')) {
                                        const match = block.match(/<div[^>]*class="[^"]*col-md-9[^"]*"[^>]*>([^<]+)<\/div>/i);
                                        if (match) {
                                                currentViolation.soQuyetDinh = match[1].trim();
                                        }
                                }
                        }

                        // Push vi phạm cuối cùng
                        if (currentViolation.hanhVi) {
                                violations.push(currentViolation);
                        }

                        console.log(`[PARSE_NEW] Parsed ${violations.length} violations from new format`);
                        return violations;

                } catch (error) {
                        console.error("Lỗi khi parse violations (new format):", error.message);
                        return [];
                }
        },

        /**
         * Parse vi phạm từ HTML định dạng cũ (table)
         * @param {string} htmlData - HTML data
         * @returns {Array} Danh sách vi phạm
         */
        parseViolations(htmlData) {
                try {
                        if (!htmlData || typeof htmlData !== 'string') {
                                return [];
                        }

                        const violations = [];
                        const rows = htmlData.split('<tr');

                        for (let i = 1; i < rows.length; i++) {
                                const row = rows[i];
                                const tdMatches = row.match(/<td[^>]*>(.*?)<\/td>/gi);
                                
                                if (tdMatches && tdMatches.length >= 5) {
                                        const cleanText = (str) => {
                                                return str
                                                        .replace(/<[^>]*>/g, '')
                                                        .replace(/&nbsp;/g, ' ')
                                                        .trim();
                                        };

                                        const violation = {
                                                stt: cleanText(tdMatches[0] || ''),
                                                hanhVi: cleanText(tdMatches[1] || ''),
                                                diaDiem: cleanText(tdMatches[2] || ''),
                                                thoiGian: cleanText(tdMatches[3] || ''),
                                                trangThai: cleanText(tdMatches[4] || ''),
                                                donVi: cleanText(tdMatches[5] || ''),
                                        };

                                        // Các trường bổ sung nếu có
                                        if (tdMatches.length >= 7) {
                                                violation.bienSo = cleanText(tdMatches[6] || '');
                                        }
                                        if (tdMatches.length >= 8) {
                                                violation.mucPhat = cleanText(tdMatches[7] || '');
                                        }
                                        if (tdMatches.length >= 9) {
                                                violation.soQuyetDinh = cleanText(tdMatches[8] || '');
                                        }

                                        violations.push(violation);
                                }
                        }

                        return violations;
                } catch (error) {
                        console.error("Lỗi khi parse violations (old format):", error.message);
                        return [];
                }
        },

        /**
         * Lấy tên loại xe từ mã
         * @param {string} loaiXe - Mã loại xe
         * @returns {string} Tên loại xe
         */
        getLoaiXeName(loaiXe) {
                const types = {
                        "1": "Ô tô",
                        "2": "Xe máy",
                        "3": "Xe điện",
                };
                return types[loaiXe] || "Không xác định";
        },
};
