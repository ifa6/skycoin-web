import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialog, MatSnackBar, MatSnackBarConfig } from '@angular/material';
import { ISubscription } from 'rxjs/Subscription';
import 'rxjs/add/operator/delay';
import 'rxjs/add/operator/filter';

import { WalletService } from '../../../../services/wallet/wallet.service';
import { SpendingService } from '../../../../services/wallet/spending.service';
import { ButtonComponent } from '../../../layout/button/button.component';
import { Wallet } from '../../../../app.datatypes';
import { openUnlockWalletModal } from '../../../../utils/index';
import { BaseCoin } from '../../../../coins/basecoin';
import { CoinService } from '../../../../services/coin.service';

@Component({
  selector: 'app-send-form',
  templateUrl: './send-form.component.html',
  styleUrls: ['./send-form.component.scss'],
})
export class SendFormComponent implements OnInit, OnDestroy {
  @ViewChild('button') button: ButtonComponent;
  @Input() formData: any;
  @Output() onFormSubmitted = new EventEmitter<any>();

  form: FormGroup;
  wallets: Wallet[];
  transactions = [];
  currentCoin: BaseCoin;

  private subscription: ISubscription;
  private coinSubscription: ISubscription;

  constructor(
    private formBuilder: FormBuilder,
    private walletService: WalletService,
    private spendingService: SpendingService,
    private snackbar: MatSnackBar,
    private unlockDialog: MatDialog,
    private coinService: CoinService
  ) {}

  ngOnInit() {
    this.initForm();

    this.walletService.currentWallets
      .subscribe(wallets => this.wallets = wallets);

    this.coinSubscription = this.coinService.currentCoin
      .subscribe((coin: BaseCoin) => this.currentCoin = coin);
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    this.coinSubscription.unsubscribe();
    this.snackbar.dismiss();
  }

  onVerify(event = null) {
    if (event) {
      event.preventDefault();
    }

    if (!this.form.valid || this.button.isLoading()) {
      return;
    }

    this.snackbar.dismiss();
    this.button.resetState();

    const wallet = this.form.value.wallet;

    if (!wallet.seed) {
      openUnlockWalletModal(wallet, this.unlockDialog).componentInstance.onWalletUnlocked
        .subscribe(() => this.createTransaction(wallet));
    } else {
      this.createTransaction(wallet);
    }
  }

  private createTransaction(wallet: Wallet) {
    this.button.setLoading();

    this.spendingService.createTransaction(wallet, this.form.value.address.replace(/\s/g, ''), this.form.value.amount)
      .subscribe(
        transaction => this.onTransactionCreated(transaction),
        error => this.onError(error)
      );
  }

  private onTransactionCreated(transaction) {
    this.onFormSubmitted.emit({
      wallet: this.form.value.wallet,
      address: this.form.value.address,
      amount: this.form.value.amount,
      transaction,
    });
  }

  private onError(error) {
    const config = new MatSnackBarConfig();
    config.duration = 300000;
    this.snackbar.open(error.message, null, config);
    this.button.setError(error.message);
  }

  private initForm() {
    this.form = this.formBuilder.group({
      wallet: ['', Validators.required],
      address: ['', Validators.required],
      amount: ['', [Validators.required]]
    });

    this.subscription = this.form.controls.wallet.valueChanges.subscribe(value => {
      const balance = value && value.balance ? value.balance : 0;

      this.form.controls.amount.setValidators([
        Validators.required,
        Validators.min(0.000001),
        Validators.max(balance),
        this.validateAmount,
      ]);

      this.form.controls.amount.updateValueAndValidity();
    });

    if (this.formData) {
      Object.keys(this.form.controls).forEach(control => {
        this.form.get(control).setValue(this.formData[control]);
      });
    }
  }

  private validateAmount(amountControl: FormControl) {
    if (!amountControl.value || isNaN(amountControl.value) || parseFloat(amountControl.value) <= 0) {
      return { Invalid: true };
    }

    const parts = amountControl.value.toString().split('.');

    if (parts.length === 2 && parts[1].length > 6) {
      return { Invalid: true };
    }

    return null;
  }
}
