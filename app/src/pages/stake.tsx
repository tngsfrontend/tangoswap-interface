import { ApprovalState, useApproveCallback } from '../hooks/useApproveCallback'
import { BAR_ADDRESS, Token, TokenAmount } from '@sushiswap/sdk'
import React, { useEffect, useState } from 'react'
import { SUSHI, XSUSHI } from '../constants'
import { formatFromBalance, formatToBalance } from '../utils'

import { BalanceProps } from '../hooks/useTokenBalance'
import Button from '../components/Button'
import { ChainId } from '@sushiswap/sdk'
import Dots from '../components/Dots'
import Head from 'next/head'
import Image from 'next/image'
import Layout from '../components/Layout'
import { Input as NumericalInput } from '../components/NumericalInput'
import TransactionFailedModal from '../components/TransactionFailedModal'
import { request } from 'graphql-request'
import styled from 'styled-components'
import sushiData from '@sushiswap/sushi-data'
import { t } from '@lingui/macro'
import { tryParseAmount } from '../state/swap/hooks'
import useActiveWeb3React from '../hooks/useActiveWeb3React'
import { useLingui } from '@lingui/react'
import useSWR from 'swr'
import useSushiBar from '../hooks/useSushiBar'
import { useTokenBalance } from '../state/wallet/hooks'
import { useWalletModalToggle } from '../state/application/hooks'

const INPUT_CHAR_LIMIT = 18

const sendTx = async (txFunc: () => Promise<any>): Promise<boolean> => {
    let success = true
    try {
        const ret = await txFunc()
        if (ret?.error) {
            success = false
        }
    } catch (e) {
        console.error(e)
        success = false
    }
    return success
}

const StyledNumericalInput = styled(NumericalInput)`
    caret-color: #e3e3e3;
`

const tabStyle =
    'flex justify-center items-center h-full w-full rounded-lg cursor-pointer text-caption2 md:text-caption'
const activeTabStyle = `${tabStyle} text-high-emphesis font-bold bg-dark-900`
const inactiveTabStyle = `${tabStyle} text-secondary`

const buttonStyle =
    'flex justify-center items-center w-full h-14 rounded font-bold md:font-medium md:text-lg mt-5 text-sm focus:outline-none focus:ring'
const buttonStyleEnabled = `${buttonStyle} text-high-emphesis bg-gradient-to-r from-pink-red to-light-brown hover:opacity-90`
const buttonStyleInsufficientFunds = `${buttonStyleEnabled} opacity-60`
const buttonStyleDisabled = `${buttonStyle} text-secondary bg-dark-700`
const buttonStyleConnectWallet = `${buttonStyle} text-high-emphesis bg-cyan-blue hover:bg-opacity-90`

const fetcher = query => request('https://api.thegraph.com/subgraphs/name/matthewlilley/bar', query)

export default function Stake() {
    const { i18n } = useLingui()
    const { account } = useActiveWeb3React()
    const sushiBalance = useTokenBalance(account ?? undefined, SUSHI[ChainId.MAINNET])
    const xSushiBalance = useTokenBalance(account ?? undefined, XSUSHI)

    const { allowance, enter, leave } = useSushiBar()

    const { data } = useSWR(
        `{
            bar(id: "0x8798249c2e607446efb7ad49ec89dd1865ff4272") {
              ratio
            }
        }`,
        fetcher
    )

    // useEffect(() => {
    //     const fetchData = async () => {
    //         const results = await Promise.all([sushiData.bar.info()])
    //         setExchangeRate(results[0].ratio)
    //     }
    //     fetchData()
    // }, [])

    const xSushiPerSushi = parseFloat(data?.bar?.ratio)

    const walletConnected = !!account
    const toggleWalletModal = useWalletModalToggle()

    const [activeTab, setActiveTab] = useState(0)
    const [modalOpen, setModalOpen] = useState(false)

    const [input, setInput] = useState<string>('')
    const [usingBalance, setUsingBalance] = useState(false)

    const balance = activeTab === 0 ? sushiBalance : xSushiBalance

    const formattedBalance = balance?.toSignificant(4)

    // const parsedInput: BalanceProps = usingBalance ? balance : formatToBalance(input !== '.' ? input : '')

    const parsedAmount = usingBalance ? balance : tryParseAmount(input, balance?.token)

    const handleInput = (v: string) => {
        if (v.length <= INPUT_CHAR_LIMIT) {
            setUsingBalance(false)
            setInput(v)
        }
    }
    const handleClickMax = () => {
        console.log('MAX', parsedAmount)
        // setInput(parsedAmount ? parsedAmount.toSignificant(balance.token.decimals).substring(0, INPUT_CHAR_LIMIT) : '')
        setInput(parsedAmount?.toExact() ?? '')
        setUsingBalance(true)
    }

    const insufficientFunds = parsedAmount && balance?.lessThan(parsedAmount)

    const inputError = insufficientFunds

    const [pendingTx, setPendingTx] = useState(false)

    const buttonDisabled = !input || pendingTx || Number(input) === 0

    const handleClickButton = async () => {
        if (buttonDisabled) return

        if (!walletConnected) {
            toggleWalletModal()
        } else {
            setPendingTx(true)

            if (activeTab === 0) {
                if (Number(allowance) === 0) {
                    const success = await sendTx(() => approve())
                    if (!success) {
                        setPendingTx(false)
                        //setModalOpen(true)
                        return
                    }
                }
                const success = await sendTx(() => enter(parsedAmount))
                if (!success) {
                    setPendingTx(false)
                    //setModalOpen(true)
                    return
                }
            } else if (activeTab === 1) {
                const success = await sendTx(() => leave(parsedAmount))
                if (!success) {
                    setPendingTx(false)
                    //setModalOpen(true)
                    return
                }
            }

            handleInput('')
            setPendingTx(false)
        }
    }

    const [approvalState, approve] = useApproveCallback(parsedAmount, BAR_ADDRESS[ChainId.MAINNET])

    console.log('approvalState:', approvalState, parsedAmount?.raw?.toString())

    const [apr, setApr] = useState<any>()

    useEffect(() => {
        const fetchData = async () => {
            const results = await Promise.all([
                sushiData.bar.info(),
                sushiData.exchange.dayData(),
                sushiData.sushi.priceUSD()
            ])
            const apr =
                (((results[1][1].volumeUSD * 0.05) / results[0].totalSupply) * 365) / (results[0].ratio * results[2])

            setApr(apr)
        }
        fetchData()
    }, [])

    console.log({ sushiBalance, xSushiBalance })

    return (
        <Layout>
            <Head>
                <title>Stake | Sushi</title>
                <meta
                    name="description"
                    content="Stake SUSHI in return for xSUSHI, an interest bearing and fungible ERC20 token designed to share revenue generated by all SUSHI products."
                />
            </Head>
            <div className="flex flex-col w-full">
                <div className="flex mb-6 justify-center">
                    <div className="flex flex-col max-w-xl w-full mb-2 mt-auto">
                        <div className="flex max-w-lg">
                            <div className="text-body font-bold md:text-h5 text-high-emphesis self-end mb-3 md:mb-7">
                                {i18n._(t`Maximize yield by staking SUSHI for xSUSHI`)}
                            </div>
                            {/* <div className="pl-6 pr-3 mb-1 min-w-max self-start md:hidden">
                                <img src={XSushiSignSmall} alt="xsushi sign" />
                            </div> */}
                        </div>
                        <div className="text-gray-500 text-sm leading-5 md:text-caption max-w-lg mb-2 md:mb-4 pr-3 md:pr-0">
                            {i18n._(t`For every swap on the exchange on every chain, 0.05% of the swap fees are distributed as SUSHI
                                proportional to your share of the SushiBar. When your SUSHI is staked into the SushiBar, you recieve
                                xSUSHI in return for voting rights and a fully composable token that can interact with other protocols.
                                Your xSUSHI is continuously compounding, when you unstake you will receive all the originally deposited
                                SUSHI and any additional from fees.`)}
                        </div>
                        {/* <div className="flex">
                            <div className="mr-14 md:mr-9">
                                <StyledLink className="text-body whitespace-nowrap text-caption2 md:text-lg md:leading-5">
                                    Enter the Kitchen
                                </StyledLink>
                            </div>
                            <div>
                                <StyledLink className="text-body whitespace-nowrap text-caption2 md:text-lg md:leading-5">
                                    Tips for using xSUSHI
                                </StyledLink>
                            </div>
                        </div> */}
                    </div>
                    <div className="hidden md:block w-72 ml-6 px-8">
                        <Image
                            src="/xsushi-sign.png"
                            alt="xSUSHI sign"
                            width="100%"
                            height="100%"
                            layout="responsive"
                        />
                    </div>
                </div>
                <div className="flex justify-center">
                    <div className="flex flex-col max-w-xl w-full">
                        <div className="mb-4">
                            <div className="flex w-full justify-between items-center max-w-xl h-24 p-4 md:pl-5 md:pr-7 rounded bg-light-yellow bg-opacity-40">
                                <div className="flex flex-col">
                                    <div className="flex flex-nowrap justify-center items-center mb-4 md:mb-2">
                                        <p className="whitespace-nowrap text-caption2 md:text-lg md:leading-5 font-bold text-high-emphesis">
                                            {i18n._(t`Staking APR`)}{' '}
                                        </p>
                                        {/* <img className="cursor-pointer ml-3" src={MoreInfoSymbol} alt={'more info'} /> */}
                                    </div>
                                    <div className="flex">
                                        <a
                                            href={`https://analytics.sushi.com/bar`}
                                            target="_blank"
                                            rel="noreferrer noopener"
                                            className={`
                        py-1 px-4 md:py-1.5 md:px-7 rounded
                        text-xs md:text-sm font-medium md:font-bold text-dark-900
                        bg-light-yellow hover:bg-opacity-90`}
                                        >
                                            {i18n._(t`View Stats`)}
                                        </a>
                                    </div>
                                </div>
                                <div className="flex flex-col">
                                    <p className="text-right text-high-emphesis font-bold text-lg md:text-h4 mb-1">
                                        {`${apr ? apr.toFixed(2) + '%' : i18n._(t`Loading...`)}`}
                                    </p>
                                    <p className="text-right text-primary w-32 md:w-64 text-caption2 md:text-base">
                                        {i18n._(t`Yesterday's APR`)}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div>
                            <TransactionFailedModal isOpen={modalOpen} onDismiss={() => setModalOpen(false)} />
                            <div className="bg-dark-900 shadow-swap-blue-glow w-full max-w-xl pt-2 pb-6 md:pb-9 px-3 md:pt-4 md:px-8 rounded">
                                <div className="flex w-full h-14 bg-dark-800 rounded">
                                    <div
                                        className="h-full w-6/12 p-0.5"
                                        onClick={() => {
                                            setActiveTab(0)
                                            handleInput('')
                                        }}
                                    >
                                        <div className={activeTab === 0 ? activeTabStyle : inactiveTabStyle}>
                                            <p>{i18n._(t`Stake SUSHI`)}</p>
                                        </div>
                                    </div>
                                    <div
                                        className="h-full w-6/12 p-0.5"
                                        onClick={() => {
                                            setActiveTab(1)
                                            handleInput('')
                                        }}
                                    >
                                        <div className={activeTab === 1 ? activeTabStyle : inactiveTabStyle}>
                                            <p>{i18n._(t`Unstake`)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center w-full mt-6">
                                    <p className="text-large md:text-h5 font-bold text-high-emphesis">
                                        {activeTab === 0 ? i18n._(t`Stake SUSHI`) : i18n._(t`Unstake`)}
                                    </p>
                                    <div className="border-gradient-r-pink-red-light-brown-dark-pink-red border-transparent border-solid border rounded-3xl px-4 md:px-3.5 py-1.5 md:py-0.5 text-high-emphesis text-xs font-medium md:text-caption md:font-normal">
                                        {`1 xSUSHI = ${xSushiPerSushi.toFixed(4)} SUSHI`}
                                    </div>
                                </div>

                                <StyledNumericalInput
                                    value={input}
                                    onUserInput={handleInput}
                                    className={`w-full h-14 px-3 md:px-5 mt-5 rounded bg-dark-800 text-caption2 md:text-lg font-bold text-dark-800${
                                        inputError ? ' pl-9 md:pl-12' : ''
                                    }`}
                                    placeholder=" "
                                />

                                {/* input overlay: */}
                                <div className="relative h-0 bottom-14 w-full pointer-events-none">
                                    <div
                                        className={`flex justify-between items-center h-14 rounded px-3 md:px-5 ${
                                            inputError ? ' border border-red' : ''
                                        }`}
                                    >
                                        <div className="flex">
                                            {inputError && (
                                                <img
                                                    className="w-4 md:w-5 mr-2"
                                                    src="/error-triangle.svg"
                                                    alt="error"
                                                />
                                            )}
                                            <p
                                                className={`text-caption2 md:text-lg font-bold ${
                                                    input ? 'text-high-emphesis' : 'text-secondary'
                                                }`}
                                            >
                                                {`${input ? input : '0'} ${activeTab === 0 ? '' : 'x'}SUSHI`}
                                            </p>
                                        </div>
                                        <div className="flex items-center text-secondary text-caption2 md:text-caption">
                                            <div
                                                className={
                                                    input ? 'hidden md:flex md:items-center' : 'flex items-center'
                                                }
                                            >
                                                <p>{i18n._(t`Balance`)}:&nbsp;</p>
                                                <p className="text-caption font-bold">{formattedBalance}</p>
                                            </div>
                                            <button
                                                className={`
                                    pointer-events-auto
                                    focus:outline-none focus:ring hover:bg-opacity-40
                                    md:bg-cyan-blue md:bg-opacity-30
                                    border border-secondary md:border-cyan-blue
                                    rounded-2xl py-1 px-2 md:py-1 md:px-3 ml-3 md:ml-4
                                    text-xs md:text-caption2 font-bold md:font-normal md:text-cyan-blue
                                `}
                                                onClick={handleClickMax}
                                            >
                                                {i18n._(t`MAX`)}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                {(approvalState === ApprovalState.NOT_APPROVED ||
                                    approvalState === ApprovalState.PENDING) &&
                                activeTab === 0 ? (
                                    <Button
                                        className={`${buttonStyle} text-high-emphesis bg-cyan-blue hover:bg-opacity-90`}
                                        disabled={approvalState === ApprovalState.PENDING}
                                        onClick={approve}
                                    >
                                        {approvalState === ApprovalState.PENDING ? (
                                            <Dots>{i18n._(t`Approving`)} </Dots>
                                        ) : (
                                            i18n._(t`Approve`)
                                        )}
                                    </Button>
                                ) : (
                                    <button
                                        className={
                                            buttonDisabled
                                                ? buttonStyleDisabled
                                                : !walletConnected
                                                ? buttonStyleConnectWallet
                                                : insufficientFunds
                                                ? buttonStyleInsufficientFunds
                                                : buttonStyleEnabled
                                        }
                                        onClick={handleClickButton}
                                    >
                                        {!walletConnected
                                            ? i18n._(t`Connect Wallet`)
                                            : !input
                                            ? i18n._(t`Enter Amount`)
                                            : insufficientFunds
                                            ? i18n._(t`Insufficient Balance`)
                                            : activeTab === 0
                                            ? i18n._(t`Confirm Staking`)
                                            : i18n._(t`Confirm Withdrawal`)}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="hidden md:block w-72 ml-6">
                        <div className="flex flex-col w-full bg-dark-900 rounded px-4 md:px-8 pt-6 pb-5 md:pt-7 md:pb-9">
                            <div className="flex flex-wrap">
                                <div className="flex flex-col flex-grow md:mb-14">
                                    <p className="mb-3 text-lg font-bold md:text-h5 md:font-medium text-high-emphesis">
                                        {i18n._(t`Balance`)}
                                    </p>
                                    <div className="flex items-center space-x-4">
                                        <Image
                                            className="max-w-10 md:max-w-16 -ml-1 mr-1 md:mr-2 -mb-1.5 rounded"
                                            src="/images/tokens/xsushi-square.jpg"
                                            alt="xSUSHI"
                                            width={64}
                                            height={64}
                                        />
                                        <div className="flex flex-col justify-center">
                                            <p className="text-caption2 md:text-lg font-bold text-high-emphesis">
                                                {xSushiBalance ? xSushiBalance.toSignificant(4) : '-'}
                                            </p>
                                            <p className="text-caption2 md:text-caption text-primary">xSUSHI</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col flex-grow">
                                    <div className="flex flex-nowrap mb-3 ml-8 md:ml-0">
                                        <p className="text-lg font-bold md:text-h5 md:font-medium text-high-emphesis">
                                            {i18n._(t`Unstaked`)}
                                        </p>
                                        {/* <img className="cursor-pointer ml-2 w-4" src={MoreInfoSymbol} alt={'more info'} /> */}
                                    </div>
                                    <div className="flex items-center ml-8 md:ml-0 space-x-4">
                                        <Image
                                            className="max-w-10 md:max-w-16 -ml-1 mr-1 md:mr-2 -mb-1.5 rounded"
                                            src="/images/tokens/sushi-square.jpg"
                                            alt="SUSHI"
                                            width={64}
                                            height={64}
                                        />
                                        <div className="flex flex-col justify-center">
                                            <p className="text-caption2 md:text-lg font-bold text-high-emphesis">
                                                {sushiBalance ? sushiBalance.toSignificant(4) : '-'}
                                            </p>
                                            <p className="text-caption2 md:text-caption text-primary">SUSHI</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col w-full mt-7 mb-4 md:mb-0">
                                    {/* <div className="flex justify-between items-center">
                        <div className="flex flex-nowrap items-center flex-1">
                            <p className="text-caption md:text-lg font-bold text-high-emphesis">Weighted APR</p>
                            <img className="cursor-pointer ml-2 w-4" src={MoreInfoSymbol} alt={'more info'} />
                        </div>
                        <div className="flex flex-1 md:flex-initial">
                            <p className="text-caption text-primary ml-5 md:ml-0">{`${weightedApr}%`}</p>
                        </div>
                    </div> */}
                                    {account && (
                                        <a
                                            href={`https://analytics.sushi.com/users/${account}`}
                                            target="_blank"
                                            rel="noreferrer noopener"
                                            className={`
                                flex flex-grow justify-center items-center
                                h-14 mt-6 rounded
                                bg-dark-700 text-high-emphesis
                                focus:outline-none focus:ring hover:bg-opacity-80
                                text-caption2 font-bold cursor-pointer
                            `}
                                        >
                                            {i18n._(t`Your SushiBar Stats`)}
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex justify-center w-full">
                    <div className="md:hidden flex justify-center w-full max-w-xl mt-6 mb-20">
                        {/* <BalanceCard
                            sushiEarnings={mockData.sushiEarnings}
                            xSushiBalance={xSushiBalance}
                            sushiBalance={sushiBalance}
                            weightedApr={mockData.weightedApr}
                        /> */}
                        <StyledNumericalInput
                            value={input}
                            onUserInput={handleInput}
                            className={`w-full h-14 px-3 md:px-5 mt-5 rounded bg-dark-800 text-caption2 md:text-lg font-bold text-dark-800${
                                inputError ? ' pl-9 md:pl-12' : ''
                            }`}
                            placeholder=" "
                        />
                    </div>
                </div>
            </div>
        </Layout>
    )
}