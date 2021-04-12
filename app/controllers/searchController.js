const {pool} = require('../../../config/database');
const {logger} = require('../../../config/winston');
const resApi = require('../../../config/functions');
const cron = require('node-cron');


/** 검색어 추가/ 검색한 상품 조회
 POST /seach
 1. 사용자가 검색한 단어
 2. 검색 상품 조회
 3. 2가지로 나눔
 (1) -> 검색어가 존재할 경우 searchCount +1
 (2) -> 새로운 검색어일 경우 search 추가
 **/
exports.insertSearchInfo = async function (req,res) {
    const userIdx = req.verifiedToken.userIdx;
    const descriptions = req.query.descriptions;
    try{
        const connection = await pool.getConnection(async conn => conn);
        try{
            await connection.beginTransaction();
            if (!descriptions) {
                connection.release();
                return res.json(resApi(false,300, "검색어를 입력하시고 다시 시도하세요."));
            }

            await connection.beginTransaction();
            const existSearchQuery = `select exists(select descriptions from searchInfo where descriptions = ?) exist;`;
            const [existSearchResult] = await connection.query(existSearchQuery, descriptions);
            console.log(existSearchResult[0].exist);
            // 이미 존재하는 검색어는 searchCount 를 + 1 update 시킨다.
            if (existSearchResult[0].exist) {
                const updateSearchCountQuery = 'update searchInfo set searchCount = searchCount + 1 where descriptions = ?;';
                const [updateSearchCountResult] = await connection.query(updateSearchCountQuery, descriptions);

                const selectSearchQuery = `select P.productIdx, P.productName, P.productImgUrl, P.productPrice, avg(R.reviewScore) as avgReviewScore, P.productReviewCount, P.productCoupangStatus, concat('모레 ', month(now()),'/', day(now() + 2), ' 도착 예정') as arriveProductDate
                                            from product P
                                            left join review R
                                            on P.productIdx = R.productIdx
                                            where productName like concat('%',?,'%')
                                            group by P.productIdx
                                            order by P.productReviewCount desc;`;
                const [selectSearchResult] = await connection.query(selectSearchQuery, descriptions);

                await connection.commit();
                let responseData = {};
                responseData = resApi(true, 101, "검색");
                responseData.updateSearchCountResult = updateSearchCountResult;
                responseData.searchResult = selectSearchResult;
                connection.release();
                return res.json(responseData);
            }

            // 새로 검색하는 단어는 search 테이블에 추가
            // 검색결과가 존재하지 않을떄(존재하는 상품이 없을 때)
            const existSearchProductQuery = `select exists(select productName from product where productName like concat('%',?,'%')) exist;`;
            const [existSearchProductResult] = await connection.query(existSearchProductQuery, descriptions);
            console.log(existSearchProductResult[0].exist);
            if (!existSearchProductResult[0].exist) {
                connection.release();
                return res.json(resApi(false, 301, "검색결과가 없습니다."));
            }

            const insertSearchQuery = `insert into searchInfo (userIdx, descriptions) values (?,?);`;
            const insertSearchParams = [userIdx, descriptions];
            const [insertSearchResult] = await connection.query(insertSearchQuery, insertSearchParams);

            const selectSearchQuery = `select P.productIdx, P.productName, P.productImgUrl, P.productPrice, avg(R.reviewScore) as avgReviewScore, P.productReviewCount, P.productCoupangStatus, concat('모레 ', month(now()),'/', day(now() + 2), ' 도착 예정') as arriveProductDate
                                            from product P
                                            left join review R
                                            on P.productIdx = R.productIdx
                                            where productName like concat('%',?,'%')
                                            group by P.productIdx
                                            order by P.productReviewCount desc;`;
            const [selectSearchResult] = await connection.query(selectSearchQuery, descriptions);
            // 트랜잭션이 정상적으로 종료되었다.
            await connection.commit();

            let responseData = {};
            responseData = resApi(true, 100, "검색");
            responseData.searchResult = insertSearchResult;
            responseData.searchProductResult = selectSearchResult;
            connection.release();
            return res.json(responseData);
        }catch (err) {
            // 트랙젝션이 비 정상적으로 종료 되었다.
            await connection.rollback(); // ROLLBACK
            connection.release();
            logger.error(`App - test Query error\n: ${err.message}`);
            return res.json(resApi(false,500,"test Query error"));
        }
    }catch (err) {
        logger.error(`App - test DB Connection error\n: ${err.message}`);
        return res.json(resApi(false,501,"test DB Connection error"));
    }
}

/** 검색 조회 화면 **/
exports.getSearchInfo = async function (req,res) {
    try{
        const connection = await pool.getConnection(async conn => conn);
        try{
            await connection.beginTransaction();
            /** 인기 검색어 **/
            const selectSearchBestQuery = `select descriptions as bestSearch from searchInfo order by searchCount desc;`;
            const [selectSearchBestResult] = await connection.query(selectSearchBestQuery);
            connection.release();

            /** 최근 검색어 **/
            const selectSearchLatelyQuery = `select descriptions as latelySearch from searchInfo order by createdAt desc limit 5;`;
            const [selectSearchLatelyResult] = await connection.query(selectSearchLatelyQuery);
            connection.release();

            let responseData = {};
            responseData = resApi(true, 100, "검색화면조회");
            responseData.searchBestResult = selectSearchBestResult;
            responseData.searchLatelyResult = selectSearchLatelyResult;
            await connection.commit();
            connection.release();
            return res.json(responseData);
        }catch (err) {
            // 트랙젝션이 비 정상적으로 종료 되었다.
            await connection.rollback(); // ROLLBACK
            connection.release();
            logger.error(`App - test Query error\n: ${err.message}`);
            return res.json(resApi(false,500,"test Query error"));
        }
    }catch (err) {
        logger.error(`App - test DB Connection error\n: ${err.message}`);
        return res.json(resApi(false,501,"test DB Connection error"));
    }
}


/** 인기검색어
 GET /search-best
 **/
exports.bestSearch = async function (req,res) {
    try{
        const connection = await pool.getConnection(async conn => conn);
        try{
            // insert 쿼리문 시작전에 트랙젝션 시작을 해줍니다.
            await connection.beginTransaction();
            // 받아온 리스트에 갯수 만큼 반복문
            const bestSearchQuery = `select descriptions from searchInfo order by searchCount desc;`;
            const [bestSearchResult] = await connection.query(bestSearchQuery);
            // 트랙젝션이 정상적으로 종료 되었다.
            await connection.commit();

            let responseData = {};
            responseData.bestSearchResult = bestSearchResult;
            connection.release();
            return res.json(responseData);
        }catch (err) {
            // 트랙젝션이 비 정상적으로 종료 되었다.
            await connection.rollback(); // ROLLBACK
            connection.release();
            logger.error(`App - test Query error\n: ${err.message}`);
            return res.json(resApi(false,500,"test Query error"));
        }
    }catch (err) {
        logger.error(`App - test DB Connection error\n: ${err.message}`);
        return res.json(resApi(false,501,"test DB Connection error"));
    }
}

/** 최근검색어 **/

// exports.test = async function (req,res) {
//     const bodyData = req.body.data;
//     try{
//         const connection = await pool.getConnection(async conn => conn);
//         try{
//             console.log(bodyData);
//             // insert 쿼리문 시작전에 트랙젝션 시작을 해줍니다.
//             await connection.beginTransaction();
//             // 받아온 리스트에 갯수 만큼 반복문
//             for(let i=0;i<bodyData.length;i++){
//                 console.log((bodyData[i]));
//                 const testQuery = `insert ~~~`;
//                 const test = await connection.query(testQuery);
//             }
//             // 트랙젝션이 정상적으로 종료 되었다.
//             await connection.commit();
//             connection.release();
//             return res.json();
//         }catch (err) {
//             // 트랙젝션이 비 정상적으로 종료 되었다.
//             await connection.rollback(); // ROLLBACK
//             connection.release();
//             logger.error(`App - test Query error\n: ${err.message}`);
//             return res.json(functions.resFormat(false,500,"test Query error"));
//         }
//     }catch (err) {
//         logger.error(`App - test DB Connection error\n: ${err.message}`);
//         return res.json(functions.resFormat(false,501,"test DB Connection error"));
//     }
// }

// cron-node를 이용
// cron.schedule(`*/1 * * * *`, exports.searchInfo = async function ()  {
//     console.log('1분마다 실행');
//         const connection = await pool.getConnection(async conn => conn);
//             // insert 쿼리문 시작전에 트랙젝션 시작을 해줍니다.
//             await connection.beginTransaction();
//             const selectSearchQuery = `update product set productClickCount = productClickCount + 1;`;
//             const [selectSearchResult] = await connection.query(selectSearchQuery);
//             // 트랙젝션이 정상적으로 종료 되었다.
//             await connection.commit();
//
//             let responseData = {};
//             responseData = resApi(true, 100, "검색");
//             responseData.selectSearchResult = selectSearchResult;
//             connection.release();
//             return
// });