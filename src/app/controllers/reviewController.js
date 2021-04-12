const {pool} = require('../../../config/database');
const {logger} = require('../../../config/winston');
const resApi = require('../../../config/functions');

/** 상품평 작성 API
 POST /product/:productIdx/review
 1. 로그인 해야 이용 가능(JWT)
 **/
exports.postReview = async function (req,res) {
    const userIdx = req.verifiedToken.userIdx;
    const productIdx = req.params.productIdx;
    const contents = req.body.contents;
    const reviewScore = req.body.reviewScore;

    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            // 상품평 내용 입력
            if (!contents) {
                connection.release();
                return res.json(resApi(false, 300, "내용을 입력하세요."));
            }
            // 별점 0~10
            if (!reviewScore) {
                connection.release();
                return res.json(resApi(false,301,"별점을 주세요."));
            }
            if (reviewScore > 5) {
                connection.release();
                return res.json(resApi(false, 302, "별점은 0~5점 사이입니다."));
            }

            const insertReviewQuery = `insert into review(userIdx, productIdx, contents, reviewScore) values (?, ?, ?, ?);`;
            const insertReviewParams = [userIdx, productIdx, contents, reviewScore];
            const [insertReviewResult] = await connection.query(insertReviewQuery, insertReviewParams);

            let responseData = {};
            responseData = resApi(true, 100, "상품평 작성 완료");
            responseData.result = insertReviewResult;
            connection.release();
            return res.json(responseData)
        } catch (err) {
            logger.error(`post PlayList transaction Query error\n: ${JSON.stringify(err)}`);
            connection.release();
            return res.json(resApi(false, 200, "trx fail"));
        }
    } catch (err) {
        logger.error(`post PlayList transaction DB Connection error\n: ${JSON.stringify(err)}`);
        return res.json(resApi(false, 201, "db connection fail"));
    }
};

/** 상품평 삭제 API
 DELETE /product/:productIdx/review
 **/
exports.deleteReview = async function (req,res) {
    const userIdx = req.verifiedToken.userIdx;
    const productIdx = req.params.productIdx;
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            const existReviewQuery = `select exists(select productIdx from review where userIdx = ? and productIdx = ?) exist;`;
            const existReviewParams = [userIdx, productIdx];
            const [existReviewResult] = await connection.query(existReviewQuery, existReviewParams);
            if (!existReviewResult[0].exist) {
                connection.release();
                return res.json(resApi(false, 300, "상품평이 존재하지 않습니다."));
            }

            const deleteReviewQuery = `delete from review where userIdx = ? and productIdx = ?;`;
            const deleteReviewParams = [userIdx, productIdx];
            const [deleteReviewResult] = await connection.query(deleteReviewQuery, deleteReviewParams);

            let responseData = {};
            responseData = resApi(true, 100, "상품평 삭제 완료");
            responseData.result = deleteReviewResult;
            connection.release();
            return res.json(responseData)
        } catch (err) {
            logger.error(`post PlayList transaction Query error\n: ${JSON.stringify(err)}`);
            connection.release();
            return res.json(resApi(false, 200, "trx fail"));
        }
    } catch (err) {
        logger.error(`post PlayList transaction DB Connection error\n: ${JSON.stringify(err)}`);
        return res.json(resApi(false, 201, "db connection fail"));
    }
};

/** 상품평 도움이돼요 API
 POST /product/:productIdx/review/:reviewIdx
 1. 회원만 도움이 돼요 가능(JWT)
 **/
exports.postReviewLike = async function (req,res) {
    const userIdx = req.verifiedToken.userIdx;
    const productIdx = req.params.productIdx;
    const reviewIdx = req.body.reviewIdx;
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            const getExistUserQuery =`select exists(select userIdx from user where userIdx = ?) as exist;`;
            const [isExistUser] = await connection.query(getExistUserQuery, userIdx);
            if(!isExistUser[0].exist){
                connection.release();
                return res.json(resApi(false,300,'유저가 존재하지 않습니다'));
            }
            const getExistReviewQuery =`select exists(select reviewIdx from review where reviewIdx = ?) as exist;`;
            const [isExistReview] = await connection.query(getExistReviewQuery, reviewIdx);
            if(!isExistReview[0].exist){
                connection.release();
                return res.json(resApi(false,301,'댓글이 존재하지 않습니다'));
            }
            const getExistProductQuery =`select exists(select productIdx from product where productIdx = ?) as exist;`;
            const [isExistProduct] = await connection.query(getExistProductQuery, productIdx);
            if(!isExistProduct[0].exist){
                connection.release();
                return res.json(resApi(false,302,'상품이 존재하지 않습니다'));
            }

            const insertReviewLikeQuery = `insert into reviewLike(userIdx, reviewIdx, productIdx) values (?, ?, ?);`;
            const insertReviewLikeParams = [userIdx, reviewIdx, productIdx];
            const [insertReviewLikeResult] = await connection.query(insertReviewLikeQuery, insertReviewLikeParams);

            const updateReviewLikeCountQuery = `update review set reviewLikeCount = reviewLikeCount + 1 where reviewIdx = ?`
            const [updateReviewLikeCountResult] = await connection.query(updateReviewLikeCountQuery, reviewIdx);

            let responseData = {};
            responseData = resApi(true, 100, "상품평 좋아요");
            responseData.result = updateReviewLikeCountResult;
            connection.release();
            return res.json(responseData)
        } catch (err) {
            logger.error(`post PlayList transaction Query error\n: ${JSON.stringify(err)}`);
            connection.release();
            return res.json(resApi(false, 200, "trx fail"));
        }
    } catch (err) {
        logger.error(`post PlayList transaction DB Connection error\n: ${JSON.stringify(err)}`);
        return res.json(resApi(false, 201, "db connection fail"));
    }
};


/** 상품에 달린 상품평 조회 (베스트순)
 GET /product/:productIdx/review/best
 **/
exports.getReviewBest = async function (req,res) {
    const productIdx = req.params.productIdx;
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            // 상품평이 존재하지 않습니다.
            const getExistReviewQuery =`select exists(select productIdx from review where productIdx = ?) as exist;`;
            const [isExistReview] = await connection.query(getExistReviewQuery, productIdx);
            if(!isExistReview[0].exist){
                connection.release();
                return res.json(resApi(false,300,'상품평이 존재하지 않습니다'));
            }

            const selectTopReviewQuery = `select avg(R.reviewScore) as avgReviewScore, P.productReviewCount
                                                from review R
                                                left join product P
                                                on P.productIdx = R.productIdx
                                                where P.productIdx = ?
                                                group by P.productIdx;`;
            const [selectTopReviewResult] = await connection.query(selectTopReviewQuery, productIdx);

            // 베스트순
            const selectReviewQuery = `select U.userName, R.reviewScore, R.contents, R.createdAt, concat(R.reviewLikeCount, '명에게 도움됐습니다.') as likes
                                        from review R
                                        left join user U
                                        on R.userIdx = U.userIdx
                                        left join product P
                                        on R.productIdx = P.productIdx
                                        where P.productIdx = ?
                                        order by R.reviewLikeCount desc;`;
            const [selectReviewResult] = await connection.query(selectReviewQuery, productIdx);

            let responseData = {};
            responseData = resApi(true, 100, "상품평조회(베스트순)");
            responseData.TopResult = selectTopReviewResult;
            responseData.Middleresult = selectReviewResult;
            connection.release();
            return res.json(responseData)
        } catch (err) {
            logger.error(`post PlayList transaction Query error\n: ${JSON.stringify(err)}`);
            connection.release();
            return res.json(resApi(false, 200, "trx fail"));
        }
    } catch (err) {
        logger.error(`post PlayList transaction DB Connection error\n: ${JSON.stringify(err)}`);
        return res.json(resApi(false, 201, "db connection fail"));
    }
};

/** 상품에 달린 상품평 조회 (최신)
 GET /product/:productIdx/review/lately
 **/
exports.getReviewLately = async function (req,res) {
    const productIdx = req.params.productIdx;
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            // 상품평이 존재하지 않습니다.
            const getExistReviewQuery = `select exists(select productIdx from review where productIdx = ?) as exist;`;
            const [isExistReview] = await connection.query(getExistReviewQuery, productIdx);
            if (!isExistReview[0].exist) {
                connection.release();
                return res.json(resApi(false, 300, '상품평이 존재하지 않습니다'));
            }

            const selectTopReviewQuery = `select avg(R.reviewScore) as avgReviewScore, P.productReviewCount
                                                from review R
                                                left join product P
                                                on P.productIdx = R.productIdx
                                                where P.productIdx = ?
                                                group by P.productIdx;`;
            const [selectTopReviewResult] = await connection.query(selectTopReviewQuery, productIdx);

            // 최신순
            const selectReviewQuery = `select U.userName, R.reviewScore, R.contents, R.createdAt, concat(R.reviewLikeCount, '명에게 도움됐습니다.') as likes
                                        from review R
                                        left join user U
                                        on R.userIdx = U.userIdx
                                        left join product P
                                        on R.productIdx = P.productIdx
                                        where P.productIdx = ?
                                        order by R.createdAt desc;`;
            const [selectReviewResult] = await connection.query(selectReviewQuery, productIdx);

            let responseData = {};
            responseData = resApi(true, 100, "상품평조회(최신순)");
            responseData.TopResult = selectTopReviewResult;
            responseData.Middleresult = selectReviewResult;
            connection.release();
            return res.json(responseData)
        } catch (err) {
            logger.error(`post PlayList transaction Query error\n: ${JSON.stringify(err)}`);
            connection.release();
            return res.json(resApi(false, 200, "trx fail"));
        }
    } catch (err) {
        logger.error(`post PlayList transaction DB Connection error\n: ${JSON.stringify(err)}`);
        return res.json(resApi(false, 201, "db connection fail"));
    }
};