// 爬取上海海洋大学综合服务平台信息(最重要的是分析报错，测试报错的能力，推断哪一行报错)
// nodejs(写入文件)+puppeteer(爬取信息)+百度AI(识别验证码）+exprss(创建服务器)
const fs = require('fs')
    // request库
const request = require('request');
// puppeteer库
const puppeteer = require('puppeteer');
// express库
const express = require('express')
const url = require('url')
const app = express()
const { get } = require('request');
const { object, func } = require('assert-plus');
const { fail } = require('assert');
const { resolve } = require('_uri-js@4.4.0@uri-js');
// nodejs无法使用es6的import和exports，需要使用babel或者在线工具进行转码
// 抓取验证码图片模块
// let downImg = (url) => {
//         let filename = './img/codeImg.png' //文件名(路径)
//         let callback = () => {
//                 console.log('图片下载成功');
//             } //回调函数
//         const stream = fs.createWriteStream(filename)
//         request(url).pipe(stream).on('close', callback)
//     }
const aiurl = 'https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic' //百度ai请求地址
let token = ''
let code = ''
let getToken = (path) => {
    return new Promise((res, err) => {
        // res()就是执行promise里面的函数+执行.then里面的函数(这个过程中把promise的状态从pending变为resolved+
        // 放进res的第一个参数就是这个promise返回的值
        request.post({
            url: 'https://aip.baidubce.com/oauth/2.0/token',
            form: {
                "grant_type": 'client_credentials',
                "client_id": 'f8uxEfswEvVkwZP3VfcbfXog',
                "client_secret": "vEHlFXhoyzv2aigCB7r6vjV8w6PaaiNf"
            }
        }, (error, response, body) => {
            if (error) {
                console.log('getToken请求错误');
                return;
            }
            // JSON.parse方法可以让服务端传来的Json对象变成js的对象
            token = JSON.parse(response.body).access_token
            getCode(token, path).then(code => { res(code) })
        })
    })
}
let getCode = (token, path) => {
        let imageFile = fs.readFileSync(path)
            // image是fs读取的文件而不是文件路径
        let image = new Buffer.from(imageFile, 'binary').toString('base64');
        return new Promise((resCode, err) => {
            // res()就是执行promise里面的函数+执行.then里面的函数(这个过程中把promise的状态从pending变为resolved+
            // 放进res的第一个参数就是这个promise返回的值
            request.post({
                url: aiurl,
                form: {
                    'access_token': token,
                    'image': image
                },
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
            }, (err, res, body) => {
                if (err) {
                    console.log(err);
                    return;
                }
                // body=res.body
                // console.log(JSON.parse(res.body).words_result[0].words);
                code = JSON.parse(body).words_result[0].words
                resCode(code)
                    // console.log(JSON.parse(res.body).words_result[0].words);
                    // console.log(res);
            })
        })
    }
    // 爬取函数
let scrape = async(uname, upwd) => {
    // 创建无头浏览器
    const broswer = await puppeteer.launch({ headless: false })
        // 创建页面
        //先连vpn
    const vpn = await broswer.newPage()
    await vpn.setViewport({ width: 1000, height: 800 })
        // try和catch作用域不互通，需要把变量提到外部再修改
        // let page = null
        // let Login = null
        // let getData = null
    await vpn.goto('https://vpn.shou.edu.cn/')
    const hasLogin = await vpn.$("#logButton");
    if (hasLogin) {
        await vpn.click('#svpn_name')
        console.log(uname);
        await vpn.keyboard.type(uname);
        await vpn.click('#svpn_password')
        await vpn.keyboard.type(upwd);
        //vpn存在验证码时启用
        // let image1 = await vpn.$('#randcodeImg')
        // if (image1) {
        //     await image1.screenshot({
        //         path: './img/code1.png'
        //     })
        //     await getToken('./img/code1.png').then(async(code) => {
        //         console.log((code.trim()).replace(/\s/g, ''));
        //         await vpn.click('#randcode');
        //         await vpn.keyboard.type((code.trim()).replace(/\s/g, ''));
        //     })
        // }
        await vpn.click('#logButton')
            // 等待十五秒
        await vpn.waitForTimeout(15000)
    } else {
        // 如果已经连接vpn,关闭
        await vpn.close()
    }
    // if (!vpn.isClosed()) {
    //     const successVpn = await vpn.$('#customer_list')
    // }
    let page = await broswer.newPage()
        // 调整视口大小
    await page.setViewport({ width: 1000, height: 800 })
        // 前往图书馆登陆页面
        // 把try和catch封装成方法来做到无限重试！！！
    let gotopage = async() => {
            try {
                await page.goto('http://uis.shou.edu.cn/cas/login')
            } catch {
                console.log('vpn连接失败，正在重连');
                // vpn未完全连接就进入页面导致加载失败，等待2秒重新加载(会无限重试直到成功)
                await page.waitForTimeout(2000)
                await gotopage()
            }
        }
        //执行一次
    await gotopage()
        // 点击输入账号框
    await page.click('#username')
        // 输入账号
    await page.keyboard.type(uname);
    let Login = async() => {
        // 点击输入密码框
        await page.click('#password')
            // 输入密码
        await page.keyboard.type(upwd);
        let image = await page.$('#imageCode > td > div > img')
            // 对验证码进行截图
        await image.screenshot({
            path: './img/code.png'
        })
        await getToken('./img/code.png').then(async(code) => {
                console.log((code.trim()).replace(/\s/g, ''));
                await page.click('#imageCodeName');
                // 用trim方法去除code中的两端空白，再用正则去除中间空格，因为验证码限制只能输入四位
                await page.keyboard.type((code.trim()).replace(/\s/g, ''));
            })
            // 点击两周内自动登录
        await page.click('#ckbRememberPP')
        await page.waitForTimeout(1000)
            // 点击登录
        try {
            await page.click('#fm1 > table > tbody > tr:nth-child(5) > td > input[type=submit]')
                //等待一秒防止误判failLogin仍然存在，此处有待优化
            await page.waitForTimeout(1000)
                // 验证码错误不会抛出错误，所以需要判断登录是否成功，如果失败，抛出错误触发catch
            let failLogin = await page.$('#fm1 > table > tbody > tr:nth-child(5) > td > input[type=submit]')
                // console.log(failLogin); //如果验证码识别正确，登录成功则为null
            if (failLogin) throw '验证码错误,正在重试'
        } catch (err) {
            //自动无限重试验证码，理解try和catch的运用
            // console.log(err);
            // 在这里输出catch到的错误会导致报错，Error: Execution context was destroyed, most likely because of a navigation.
            //暂时不理解报错的原因
            await Login()
        }
        // 前往数字平台页面，不用等待
        await page.goto('http://ecampus.shou.edu.cn/')
    }
    await Login()
    let cost = ''
    let names = ''
    let moneys = ''
    let getData = async() => {
            const name = await page.$eval('#p_p_id_UserCenter_WAR_shouUserCenterportlet_ > div > div > div.view-content > div > div > div > div > ul > li:nth-child(1) > span', e => e.innerText)
            console.log(name);
            names = name
            const money = await page.$eval('#p_p_id_UserCenter_WAR_shouUserCenterportlet_ > div > div > div.view-content > div > div > div > ul > li:nth-child(4) > h3 > span', e => e.innerText)
            moneys = money
            console.log(money);
            await page.goto('http://ecampus.shou.edu.cn/web/guest/yktconsume')
                // forEach会创建一个新的非async函数，导致无法使用await，所以用for循环
                // getData=data
            const Data = await page.evaluate(() => {
                let thdata = []
                let tddata = []
                const ths = document.querySelectorAll('th')
                const tds = document.querySelectorAll('.xfmx-table td')
                const rows = 0
                for (var th of ths) {
                    thdata.push(th.innerText)
                }
                for (var td of tds) {
                    tddata.push(td.innerText)
                }
                return { thdata, tddata }
            })
            let thdata = Data.thdata
            let tddata = Data.tddata
            let consume = []
            for (let p = 0; p < tddata.length; p = p + 6) {
                consume.push(tddata.slice(p, p + 6))
            }
            console.log(consume);
            cost = consume
        }
        // 验证码错误会有延迟导致执行其下代码而报错，所以需要判断登录是否成功，如果失败，抛出错误触发catch
        // let failLogin = await page.$('#fm1 > table > tbody > tr:nth-child(5) > td > input[type=submit]')
        // console.log(failLogin); //如果验证码识别正确，登录成功则为null
        // if (failLogin) throw '验证码错误'
        // if (failLogin) {
        //     async function retry() {
        //         await page.reload('http://uis.shou.edu.cn/cas/login')
        //         await page.click('#password')
        //         await page.keyboard.type('a13288923210');
        //         let image = await page.$('#imageCode > td > div > img')
        //         await image.screenshot({
        //             path: './img/code.png'
        //         })
        //         await getToken().then(async(code) => {
        //             console.log(code.trim().replace(/\s/g, ''));
        //             await page.click('#imageCodeName');
        //             await page.keyboard.type((code.trim()).replace(/\s/g, ''));
        //         })
        //         await page.click('#ckbRememberPP')
        //         await page.click('#fm1 > table > tbody > tr:nth-child(5) > td > input[type=submit]')
        //     }
        //     //自动试错一次
        //     retry().catch(() => {
        //         retry()
        //     })
        // }
        // 要await登录方法结束后再执行下一个方法否则会抛出错误

    await getData()
    return {
        cost: cost,
        name: names,
        money: moneys
    }
}
let port = 3000
app.get('/', (req, res) => {
    let uname = url.parse(req.url, true).query.uname
    let upwd = url.parse(req.url, true).query.upwd
        //配置跨域
    res.header("Access-Control-Allow-Origin", "*");
    scrape(uname, upwd).then((value) => { res.send(value) })
})
app.listen(port, () => { console.log(`express is run in ${port}`); })
    // const port = 3000

// app.get('/', (req, res) => res.send('Hello World!'))

// app.listen(port, () => console.log(`Example app listening on port ${port}!`))