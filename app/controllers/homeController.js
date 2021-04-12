const {pool} = require('../../../config/database');
const {logger} = require('../../../config/winston');
const resApi = require('../../../config/functions');

/** 홈화면 조회
 GET /home
 1. 추천상품
 2. 특가일 때 구매하세요
 3. 쿠팡 only 상품
 4. 요즘 잘나가는 상품 x
 UPDATE 2020.11.05(목)**/
exports.getHome = async function (req,res) {
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            await connection.beginTransaction();
            // 1. 추천상품
            const selectRecommendHomeQuery = `select P.productIdx, P.productName, P.productImgUrl, P.productPrice, avg(R.reviewScore) as avgReviewScore, P.productReviewCount
                                                from product P
                                                left join review R
                                                on P.productIdx = R.productIdx
                                                group by P.productIdx
                                                order by P.productClickCount desc
                                                limit 5;`;
            const [selectRecommendHomeResult] = await connection.query(selectRecommendHomeQuery);

            // 2. 특가일 때 구매하세요
            const selectGoopPriceHomeQuery = `select P.productIdx, P.productName, P.productImgUrl, P.productPrice, avg(R.reviewScore) as avgReviewScore, P.productReviewCount
                                                from product P
                                                left join review R
                                                on P.productIdx = R.productIdx
                                                group by P.productIdx
                                                order by P.productPrice asc
                                                limit 5;`;
            const [selectGoodPriceHomeResult] = await connection.query(selectGoopPriceHomeQuery);

            // 3. 쿠팡 only 상품
            const selectCoupangOnlyHomeQuery = `select P.productIdx, P.productName, P.productImgUrl, P.productPrice, avg(R.reviewScore) as avgReviewScore, P.productReviewCount, P.productCoupangStatus as 'rocketSipping'
                                                    from product P
                                                    left join review R
                                                    on P.productIdx = R.productIdx
                                                    group by P.productIdx
                                                    having P.productCoupangStatus =1
                                                    limit 5;`;
            const [selectCoupangOnlyHomeResult] = await connection.query(selectCoupangOnlyHomeQuery);

            // 4. 요즘 잘나가는 상품
            const selectBestProductQuery = `select P.productIdx, P.productName, P.productImgUrl, P.productPrice, avg(R.reviewScore) as avgReviewScore, P.productReviewCount, P.productCoupangStatus
                                            from product P
                                            left join review R
                                            on P.productIdx = R.productIdx
                                            group by P.productIdx
                                            order by P.productReviewCount desc
                                            limit 5;`;
            const [selectBestProductResult] = await connection.query(selectBestProductQuery);

            let responseData = {};
            responseData = resApi(true, 100, "홈화면조회");
            responseData.recommendResult = selectRecommendHomeResult;
            responseData.goodPriceResult = selectGoodPriceHomeResult;
            responseData.CoupangOnlyResult = selectCoupangOnlyHomeResult;
            responseData.bestResult = selectBestProductResult;

            connection.release();
            return res.json(responseData)
        } catch (err) {
            logger.error(`post PlayList transaction Query error\n: ${JSON.stringify(err)}`);
            connection.release();
            return res.json(resApi(false, 200, "trx fail"))
        }
    } catch (err) {
        logger.error(`post PlayList transaction DB Connection error\n: ${JSON.stringify(err)}`);
        return res.json(resApi(false, 201, "db connection fail"));
    }
};

// /** 추천상품조회
//  GET /home/product/recommend
//  1. 내가 상품을 클릭한 수를 기준으로 (productClickCount) 를 desc
//  **/
// exports.getRecommendProduct = async function (req,res) {
//     const userIdx = req.verifiedToken.userIdx;
//     try {
//         const connection = await pool.getConnection(async conn => conn());
//         try {
//             // 누구를 위한 추천 상품
//             const selectRecommendUserQuery = `select concat(userName, '를 위한 추천 상품') as recommendProduct from user where userIdx=?;`;
//             const [selectRecommendUserResult] = await connection.query(selectRecommendUserQuery, userIdx);
//
//             // 추천 상품
//             const selectRecommendQuery = `select P.productIdx, P.productName, P.productImgUrl, P.productPrice, avg(R.reviewScore) as avgReviewScore, P.productReviewCount, P.productCoupangStatus
//                                             from product P
//                                             left join review R
//                                             on P.productIdx = R.productIdx
//                                             group by P.productIdx
//                                             order by P.productClickCount desc;`;
//             const [selectRecommendResult] = await connection.query(selectRecommendQuery);
//
//             let responseData = {};
//             responseData = resApi(true, 100, "추천상품");
//             responseData.userName = selectRecommendUserResult;
//             responseData.result = selectRecommendResult;
//             connection.release();
//             return res.json(responseData)
//         } catch (err) {
//             logger.error(`post PlayList transaction Query error\n: ${JSON.stringify(err)}`);
//             connection.release();
//             return res.json(resApi(false, 200, "trx fail"))
//         }
//     } catch (err) {
//         logger.error(`post PlayList transaction DB Connection error\n: ${JSON.stringify(err)}`);
//         return res.json(resApi(false, 201, "db connection fail"));
//     }
// };

/** 추천상품조회
 GET /home/product/recommend
 1. 내가 상품을 클릭한 수를 기준으로 (productClickCount) 를 desc
 **/
exports.getRecommendProduct = async function (req,res) {
    const userIdx = req.verifiedToken.userIdx;
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            // 누구를 위한 추천 상품
            await connection.beginTransaction();

            const selectRecommendUserQuery = `select concat(userName, '를 위한 추천 상품') as recommendProduct from user where userIdx=?;`;
            const [selectRecommendUserResult] = await connection.query(selectRecommendUserQuery, userIdx);

            const latelyOrderProductQuery = `select O.productIdx, P.productCategory
                                                from orderInfo O
                                                left join product P
                                                on O.productIdx = P.productIdx
                                                where O.userIdx = ?
                                                order by O.orderIdx desc
                                                limit 1;`;
            const [latelyOrderProductResult] = await connection.query(latelyOrderProductQuery, userIdx);
            console.log(latelyOrderProductResult[0].productCategory)

            // productCategory 가 1일때 세제류
            if (latelyOrderProductResult[0].productCategory === 1) {
                const selectRecommendQuery = `select P.productIdx, P.productName, P.productImgUrl, P.productPrice, avg(R.reviewScore) as avgReviewScore, P.productReviewCount, P.productCoupangStatus
                                            from product P
                                            left join review R
                                            on P.productIdx = R.productIdx
                                            where P.productCategory = 1
                                            group by P.productIdx;`;
                const [selectRecommendResult] = await connection.query(selectRecommendQuery);

                let responseData = {};
                responseData = resApi(true, 100, "추천상품");
                responseData.userName = selectRecommendUserResult;
                responseData.result = selectRecommendResult;
                await connection.commit();
                connection.release();
                return res.json(responseData)
            }

            // productCategory 가 2일때 옷/의류
            if (latelyOrderProductResult[0].productCategory === 2) {
                const selectRecommendQuery = `select P.productIdx, P.productName, P.productImgUrl, P.productPrice, avg(R.reviewScore) as avgReviewScore, P.productReviewCount, P.productCoupangStatus
                                            from product P
                                            left join review R
                                            on P.productIdx = R.productIdx
                                            where P.productCategory = 2
                                            group by P.productIdx;`;
                const [selectRecommendResult] = await connection.query(selectRecommendQuery);

                let responseData = {};
                responseData = resApi(true, 100, "추천상품");
                responseData.userName = selectRecommendUserResult;
                responseData.result = selectRecommendResult;
                await connection.commit();
                connection.release();
                return res.json(responseData);
            }

            // productCategory 가 3일때 식품
            if (latelyOrderProductResult[0].productCategory === 3) {
                const selectRecommendQuery = `select P.productIdx, P.productName, P.productImgUrl, P.productPrice, avg(R.reviewScore) as avgReviewScore, P.productReviewCount, P.productCoupangStatus
                                            from product P
                                            left join review R
                                            on P.productIdx = R.productIdx
                                            where P.productCategory = 3
                                            group by P.productIdx;`;
                const [selectRecommendResult] = await connection.query(selectRecommendQuery);

                let responseData = {};
                responseData = resApi(true, 100, "추천상품");
                responseData.userName = selectRecommendUserResult;
                responseData.result = selectRecommendResult;
                await connection.commit();
                connection.release();
                return res.json(responseData);
            }

            // productCategory 가 4일때 액세서리
            if (latelyOrderProductResult[0].productCategory === 4) {
                const selectRecommendQuery = `select P.productIdx, P.productName, P.productImgUrl, P.productPrice, avg(R.reviewScore) as avgReviewScore, P.productReviewCount, P.productCoupangStatus
                                            from product P
                                            left join review R
                                            on P.productIdx = R.productIdx
                                            where P.productCategory = 3
                                            group by P.productIdx;`;
                const [selectRecommendResult] = await connection.query(selectRecommendQuery);

                let responseData = {};
                responseData = resApi(true, 100, "추천상품");
                responseData.userName = selectRecommendUserResult;
                responseData.result = selectRecommendResult;
                await connection.commit();
                connection.release();
                return res.json(responseData);
            }
        } catch (err) {
            await connection.rollback(); // ROLLBACK
            connection.release();
            logger.error(`post PlayList transaction Query error\n: ${JSON.stringify(err)}`);
            connection.release();
            return res.json(resApi(false, 200, "trx fail"))
        }
    } catch (err) {
        logger.error(`post PlayList transaction DB Connection error\n: ${JSON.stringify(err)}`);
        return res.json(resApi(false, 201, "db connection fail"));
    }
};

/** 쿠팡 only 상품
 GET /home/product/only
 1. productCoupangStatus = 1 -> 쿠팡상품
 2. productCoupangStatus = 0 -> 쿠팡상품 x
 **/
exports.getCoupangOnlyProduct = async function (req,res) {
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            // 오직 쿠팡에서만
            const selectCoupangOnlyQuery = `select P.productIdx, P.productName, P.productImgUrl, P.productPrice, avg(R.reviewScore) as avgReviewScore, P.productReviewCount, P.productCoupangStatus
                                                    from product P
                                                    left join review R
                                                    on P.productIdx = R.productIdx
                                                    group by P.productIdx
                                                    having P.productCoupangStatus = 1;`;
            const [selectCoupangOnlyResult] = await connection.query(selectCoupangOnlyQuery);

            let responseData = {};
            responseData = resApi(true, 100, "only 쿠팡");
            responseData.coupangOnlyResult = selectCoupangOnlyResult;
            connection.release();
            return res.json(responseData)
        } catch (err) {
            logger.error(`post PlayList transaction Query error\n: ${JSON.stringify(err)}`);
            connection.release();
            return res.json(resApi(false, 200, "trx fail"))
        }
    } catch (err) {
        logger.error(`post PlayList transaction DB Connection error\n: ${JSON.stringify(err)}`);
        return res.json(resApi(false, 201, "db connection fail"));
    }
};


/** 요즘 잘나가는 상품
 GET /home/best
 UPDATE 2020.11.06(금)
 1. review 가 많이 달린 상품
 2. 구매가 많은 상품
 둘 중 하나/ 일단 리뷰가 많이 달린 상품으로
 **/
exports.getBestProduct = async function (req,res) {
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            // 요즘 잘나가는 상품
            const selectBestProductQuery = `select P.productIdx, P.productName, P.productImgUrl, P.productPrice, avg(R.reviewScore) as avgReviewScore, P.productReviewCount, P.productCoupangStatus
                                            from product P
                                            left join review R
                                            on P.productIdx = R.productIdx
                                            group by P.productIdx
                                            order by P.productReviewCount desc;`;
            const [selectBestProductResult] = await connection.query(selectBestProductQuery);

            let responseData = {};
            responseData = resApi(true, 100, "요즘 잘나가는 상품");
            responseData.coupangOnlyResult = selectBestProductResult;
            connection.release();
            return res.json(responseData)
        } catch (err) {
            logger.error(`post PlayList transaction Query error\n: ${JSON.stringify(err)}`);
            connection.release();
            return res.json(resApi(false, 200, "trx fail"))
        }
    } catch (err) {
        logger.error(`post PlayList transaction DB Connection error\n: ${JSON.stringify(err)}`);
        return res.json(resApi(false, 201, "db connection fail"));
    }
};

/** 특가일 때 구매
 GET /home/sale
 가격이 낮은 순
 **/
exports.getSaleProduct = async function (req,res) {
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            // 특가일 때 구매
            const selectBestProductQuery = `select P.productIdx, P.productName, P.productImgUrl, P.productPrice, avg(R.reviewScore) as avgReviewScore, P.productReviewCount, P.productCoupangStatus
                                            from product P
                                            left join review R
                                            on P.productIdx = R.productIdx
                                            group by P.productIdx
                                            order by P.productPrice asc;`;
            const [selectBestProductResult] = await connection.query(selectBestProductQuery);

            let responseData = {};
            responseData = resApi(true, 100, "특가 상품");
            responseData.coupangOnlyResult = selectBestProductResult;
            connection.release();
            return res.json(responseData)
        } catch (err) {
            logger.error(`post PlayList transaction Query error\n: ${JSON.stringify(err)}`);
            connection.release();
            return res.json(resApi(false, 200, "trx fail"))
        }
    } catch (err) {
        logger.error(`post PlayList transaction DB Connection error\n: ${JSON.stringify(err)}`);
        return res.json(resApi(false, 201, "db connection fail"));
    }
};