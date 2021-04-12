const {pool} = require('../../../config/database');
const {logger} = require('../../../config/winston');
const resApi = require('../../../config/functions');

/** 상품조회를 하면 조회수 증가 -> productClickCount를 이용해서 /product/recommend에 추천상품 나열
 POST /product/:productIdx
 1. user가 상품을 클릭하면 productClickCount 테이블에 userIdx, productIdx 추가
 2. product 테이블에 productClickCount +1 증가
 3. 상품을 조회했을때 product 상품 조회
 4. JWT 적용
 **/
exports.clickProduct = async function (req,res) {
    const productIdx = req.params.productIdx;
    const userIdx = req.body.userIdx;
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            const getExistProductQuery =`select exists(select productIdx from product where productIdx = ?) as exist;`;
            const [productExist] = await connection.query(getExistProductQuery, productIdx);
            if(!productExist[0].exist){
                connection.release();
                return res.json(resApi(false,200,'존재하지 않는 상품입니다.'));
            }

            // productClick에 존재한다면 productClickCount(product) +1 update만 시킴
            const getExistProductClickQuery =`select exists(select userIdx, productIdx from productClick where userIdx = ? and productIdx = ?) as exist;`;
            const getExistProductClickParams = [userIdx, productIdx];
            const [productClickExist] = await connection.query(getExistProductClickQuery, getExistProductClickParams);
            if(productClickExist[0].exist) {
                const updateClickProductCountQuery = `update product set productClickCount = productClickCount + 1 where productIdx = ?;`;
                const [updateClickProductCountResult] = await connection.query(updateClickProductCountQuery, productIdx);

                let responseData = {};
                responseData = resApi(true, 100, "상품조회 +1");
                responseData.result = updateClickProductCountResult;
                connection.release();
                return res.json(responseData)
            }
            const insertClickProductQuery = `insert into productClick(productIdx, userIdx) values (?, ?);`;
            const insertClickProductParams = [productIdx, userIdx];
            const [insertClickProductResult] = await connection.query(insertClickProductQuery, insertClickProductParams);

            const updateClickProductCountQuery = `update product set productClickCount = productClickCount + 1 where productIdx=?;`;
            const [updateClickProductCountResult] = await connection.query(updateClickProductCountQuery, productIdx);

            let responseData = {};
            responseData = resApi(true, 100, "상품조회");
            responseData.result = updateClickProductCountResult;
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

/** 상품 클릭했을 때 조회 API
 GET /product/:productIdx
 필요 정보
 1. 상품이름, 상품이미지, 상품평별점, 상품평 수, 상품가격, 상품내용이미지 -> 현재 존재
 2. 배송(로켓배송인지, 일반배송인지), 상품평 -> 추가
 **/
exports.getProduct = async function (req,res) {
    const productIdx = req.params.productIdx;
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            const getExistProductQuery =`select exists(select productIdx from product where productIdx = ?) as exist;`;
            const [isExist] = await connection.query(getExistProductQuery, productIdx);
            if(!isExist[0].exist){
                connection.release();
                return res.json(resApi(false,200,'존재하지 않는 상품입니다.'));
            }

            const selectGetProductQuery = `select P.productIdx, P.productName, avg(R.reviewScore) avgReviewScore, P.productImgUrl, P.productReviewCount, P.productPrice, P.productUrl, P.productCoupangStatus, concat('모레 ', month(now()),'/', day(now() + 2), ' 도착 예정') as productArriveDate
                                            from product P
                                            left join review R
                                            on P.productIdx = R.productIdx
                                            where P.productIdx = ?
                                            group by P.productIdx;`;
            const [selectGetProductResult] = await connection.query(selectGetProductQuery, productIdx);
            if (selectGetProductResult[0].avgReviewScore === null) {
                connection.release();
                selectGetProductResult[0].avgReviewScore = 0;
            }
            /** 색상 **/
            const getProductOptionColorCountQuery = `select count(optionColorIdx) optionColorCount from optionColor where productIdx = ?;`;
            const [getProductOptionColorCountResult] = await connection.query(getProductOptionColorCountQuery, productIdx);

            const getProductOptionColorQuery = `select P.productIdx, OC.productColorIdx as optionColorIdx, OC.productColor,  OC.productColorOptionUrl
                                                    from product P
                                                    left join  optionColor OC
                                                    on P.productIdx = OC.productIdx
                                                    where P.productIdx = ?;`;
            const [getProductOptionColorResult] = await connection.query(getProductOptionColorQuery, productIdx);

            /** 사이즈 **/
            const getProductOptionSizeCountQuery = `select count(optionSizeIdx) optionSizeCount from optionSize where productIdx = ?;`;
            const [getProductOptionSizeCountResult] = await connection.query(getProductOptionSizeCountQuery, productIdx);

            const getProductOptionSizeQuery = `select P.productIdx, OS.productSizeIdx as optionSizeIdx, OS.productSize, OS.productSize
                                                    from product P
                                                    left join optionSize OS
                                                    on P.productIdx = OS.productIdx
                                                    where P.productIdx = ?;`;
            const [getProductOptionSizeResult] = await connection.query(getProductOptionSizeQuery, productIdx);

            const avgReviewScoreQuery = `select P.productIdx, avg(R.reviewScore) avgReviewScore, P.productReviewCount
                                            from product P
                                            left join review R
                                            on R.productIdx = P.productIdx
                                            where P.productIdx = ?;`;
            const [avgReviewScoreResult] = await connection.query(avgReviewScoreQuery, productIdx);
            if (avgReviewScoreResult[0].avgReviewScore === null) {
                connection.release();
                avgReviewScoreResult[0].avgReviewScore = 0;
            }

            const selectGetProductReviewContentQuery = `select P.productIdx, U.userName, R.reviewScore, R.createdAt, R.contents
                                        from review R
                                        left join user U
                                        on U.userIdx = R.userIdx
                                        left join product P
                                        on R.productIdx = P.productIdx
                                        where P.productIdx = ?
                                        limit 3;`;
            const [selectGetProductReviewContentResult] = await connection.query(selectGetProductReviewContentQuery, productIdx);
            // if (selectGetProductReviewContentResult[0].contents === null) {
            //     connection.release();
            //     selectGetProductReviewContentResult[0].contents = "등록된 상품평이 없습니다.";
            // }

            let responseData = {};
            responseData = resApi(true, 100, "상품상세조회");
            responseData.productResult = selectGetProductResult;
            responseData.productOptionColorCountResult = getProductOptionColorCountResult;
            responseData.productOptionColorResult = getProductOptionColorResult;
            responseData.productOptionSizeCountResult = getProductOptionSizeCountResult;
            responseData.productOptionSizeResult = getProductOptionSizeResult;
            responseData.productReviewScoreResult = avgReviewScoreResult;
            responseData.productReviewContentResult = selectGetProductReviewContentResult;
            connection.release();
            return res.json(responseData);
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





