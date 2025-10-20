const axios = require("axios");

const GENSHIN_ACT_ID = "e202102251931481"; // Act ID for Genshin Impact daily check-in
const BASE = "https://sg-hk4e-api.hoyolab.com";

// Function to validate cookie format
function validateCookieFormat(cookie) {
	if (!cookie || typeof cookie !== "string") {
		return { valid: false, reason: "Cookie không tồn tại hoặc không phải string" };
	}

	const trimmedCookie = cookie.trim();
	if (trimmedCookie.length === 0) {
		return { valid: false, reason: "Cookie trống" };
	}

	const hasLtuid = trimmedCookie.includes("ltuid_v2=");
	const hasLtoken = trimmedCookie.includes("ltoken_v2=");
	const hasLtmid = trimmedCookie.includes("ltmid_v2=");
	const hasAccountMid = trimmedCookie.includes("account_mid_v2=");
	const hasAccountId = trimmedCookie.includes("account_id_v2=");
	const hasCookieToken = trimmedCookie.includes("cookie_token_v2=");

	if (!hasLtuid && !hasLtoken && !hasCookieToken && !hasLtmid && !hasAccountMid && !hasAccountId) {
		return {
			valid: false,
			reason:
				"Cookie thiếu các thành phần cần thiết (ltuid_v2, ltoken_v2, cookie_token_v2, ltmid_v2, account_mid_v2, account_id_v2)",
		};
	}

	return { valid: true, reason: "Cookie format hợp lệ" };
}

function buildHeaders(cookie) {
	const headers = {
		Cookie: cookie,
		Referer: `https://act.hoyolab.com/ys/event/signin-sea-v3/index.html?act_id=${GENSHIN_ACT_ID}`,
		Origin: "https://act.hoyolab.com",
		"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
		Accept: "application/json, text/plain, */*",
		"Accept-Language": "en-US,en;q=0.9",
		"Accept-Encoding": "gzip, deflate, br",
		Connection: "keep-alive",
		"Sec-Fetch-Dest": "empty",
		"Sec-Fetch-Mode": "cors",
		"Sec-Fetch-Site": "same-site",
	};
	return headers;
}

async function fetchSignInfo(cookie) {
	const url = `${BASE}/event/sol/info?act_id=${GENSHIN_ACT_ID}`;

	try {
		const res = await axios.get(url, { headers: buildHeaders(cookie), timeout: 20000 });
		return res.data;
	} catch (error) {
		throw error;
	}
}

async function fetchHome(cookie) {
	const url = `${BASE}/event/sol/home?act_id=${GENSHIN_ACT_ID}`;

	try {
		const res = await axios.get(url, { headers: buildHeaders(cookie), timeout: 20000 });
		return res.data;
	} catch (error) {
		throw error;
	}
}

async function postSign(cookie) {
	const url = `${BASE}/event/sol/sign`;
	const payload = { act_id: GENSHIN_ACT_ID };

	try {
		const res = await axios.post(url, payload, {
			headers: {
				...buildHeaders(cookie),
				"Content-Type": "application/json;charset=UTF-8",
			},
			timeout: 20000,
		});
		return res.data;
	} catch (error) {
		throw error;
	}
}

async function claimGenshinDaily(cookie) {
	// Validate cookie format first
	const cookieValidation = validateCookieFormat(cookie);
	if (!cookieValidation.valid) {
		return { status: "error", message: cookieValidation.reason };
	}

	try {
		const info = await fetchSignInfo(cookie);

		if (info?.retcode !== 0) {
			// Provide more specific error messages based on retcode
			let errorMessage = info?.message || "Không thể lấy trạng thái đăng nhập.";
			if (info?.retcode === -100) {
				errorMessage = "Cookie không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại vào Hoyolab.";
			} else if (info?.retcode === -101) {
				errorMessage = "Tài khoản không tồn tại hoặc bị khóa.";
			} else if (info?.retcode === -1) {
				errorMessage = "Lỗi hệ thống Hoyolab. Vui lòng thử lại sau.";
			} else if (info?.retcode === 10001) {
				errorMessage = "Cookie đã hết hạn. Vui lòng đăng nhập lại.";
			}

			return { status: "error", message: errorMessage };
		}

		const isSigned = info?.data?.is_sign;
		const totalDays = info?.data?.total_sign_day;

		// Fetch home to know today reward
		let rewardName = null;
		try {
			const home = await fetchHome(cookie);
			const awards = home?.data?.awards || [];
			const todayIndex = Math.max(0, (totalDays || 0) - (isSigned ? 1 : 0));

			if (awards[todayIndex]) {
				rewardName = `${awards[todayIndex]?.name} x${awards[todayIndex]?.cnt}`;
			}
		} catch (homeError) {}

		if (isSigned) {
			return { status: "already", message: "Hôm nay bạn đã nhận điểm danh.", totalDays, rewardName };
		}

		const result = await postSign(cookie);

		if (result?.retcode === 0) {
			return { status: "claimed", message: "Nhận điểm danh thành công!", totalDays: (totalDays || 0) + 1, rewardName };
		}

		// retcode != 0
		const msg = result?.message || "Nhận điểm danh thất bại.";
		return { status: "error", message: msg, totalDays, rewardName };
	} catch (err) {
		const msg = err?.response?.data?.message || err?.message || "Lỗi không xác định khi claim.";
		return { status: "error", message: msg };
	}
}

module.exports = { claimGenshinDaily };
